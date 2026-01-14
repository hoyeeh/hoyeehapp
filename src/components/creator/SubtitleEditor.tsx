import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Play, Pause, Save, User, Clock, Type, 
  ChevronLeft, ChevronRight, Loader2, Plus, Trash2,
  SkipBack, SkipForward, Volume2
} from "lucide-react";

interface SubtitleCue {
  id: string;
  index: number;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
  speakerLabel?: string;
}

interface SubtitleEditorProps {
  subtitleId: string;
  videoUrl: string;
  onClose?: () => void;
}

// Parse VTT timestamp to seconds
function parseVttTimestamp(timestamp: string): number {
  const parts = timestamp.split(":");
  if (parts.length === 3) {
    const [hours, minutes, secondsAndMs] = parts;
    const [seconds, ms] = secondsAndMs.split(".");
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      (parseInt(ms || "0") / 1000)
    );
  } else if (parts.length === 2) {
    const [minutes, secondsAndMs] = parts;
    const [seconds, ms] = secondsAndMs.split(".");
    return (
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      (parseInt(ms || "0") / 1000)
    );
  }
  return 0;
}

// Format seconds to VTT timestamp
function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

// Format for display (MM:SS.ms)
function formatDisplayTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

// Parse VTT content to cues
function parseVtt(vttContent: string): SubtitleCue[] {
  const lines = vttContent.split("\n");
  const cues: SubtitleCue[] = [];
  let currentCue: Partial<SubtitleCue> = {};
  let textLines: string[] = [];
  let cueIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE")) {
      continue;
    }

    if (line.includes("-->")) {
      const [start, end] = line.split("-->").map((t) => t.trim().split(" ")[0]);
      currentCue = {
        id: `cue-${cueIndex}`,
        index: cueIndex++,
        startTime: parseVttTimestamp(start),
        endTime: parseVttTimestamp(end),
      };
      textLines = [];
    } else if (line === "" && currentCue.startTime !== undefined) {
      if (textLines.length > 0) {
        // Check for speaker label pattern like [Speaker Name]:
        let speakerLabel: string | undefined;
        let text = textLines.join("\n");
        const speakerMatch = text.match(/^\[([^\]]+)\]:\s*/);
        if (speakerMatch) {
          speakerLabel = speakerMatch[1];
          text = text.replace(speakerMatch[0], "");
        }
        currentCue.text = text;
        currentCue.speakerLabel = speakerLabel;
        cues.push(currentCue as SubtitleCue);
      }
      currentCue = {};
      textLines = [];
    } else if (currentCue.startTime !== undefined && line && !line.match(/^\d+$/)) {
      textLines.push(line);
    }
  }

  // Handle last cue
  if (currentCue.startTime !== undefined && textLines.length > 0) {
    let text = textLines.join("\n");
    const speakerMatch = text.match(/^\[([^\]]+)\]:\s*/);
    if (speakerMatch) {
      currentCue.speakerLabel = speakerMatch[1];
      text = text.replace(speakerMatch[0], "");
    }
    currentCue.text = text;
    cues.push(currentCue as SubtitleCue);
  }

  return cues;
}

// Convert cues back to VTT
function cuesToVtt(cues: SubtitleCue[]): string {
  let vtt = "WEBVTT\n\n";

  for (const cue of cues) {
    vtt += `${formatVttTimestamp(cue.startTime)} --> ${formatVttTimestamp(cue.endTime)}\n`;
    if (cue.speakerLabel) {
      vtt += `[${cue.speakerLabel}]: ${cue.text}\n\n`;
    } else {
      vtt += `${cue.text}\n\n`;
    }
  }

  return vtt;
}

export function SubtitleEditor({ subtitleId, videoUrl, onClose }: SubtitleEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const [selectedCue, setSelectedCue] = useState<SubtitleCue | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalVtt, setOriginalVtt] = useState("");

  // Fetch subtitle data
  const { data: subtitle, isLoading: loadingSubtitle } = useQuery({
    queryKey: ["subtitle-edit", subtitleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtitles")
        .select("*")
        .eq("id", subtitleId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch VTT content
  const { data: vttContent, isLoading: loadingVtt } = useQuery({
    queryKey: ["subtitle-vtt", subtitle?.cdn_url || subtitle?.subtitle_url],
    queryFn: async () => {
      const url = subtitle?.cdn_url || subtitle?.subtitle_url;
      if (!url) throw new Error("No subtitle URL");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch subtitle file");
      return response.text();
    },
    enabled: !!subtitle?.cdn_url || !!subtitle?.subtitle_url,
  });

  // Parse VTT when loaded
  useEffect(() => {
    if (vttContent) {
      setOriginalVtt(vttContent);
      setCues(parseVtt(vttContent));
    }
  }, [vttContent]);

  // Update active cue based on video time
  useEffect(() => {
    const activeCue = cues.findIndex(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );
    setActiveCueIndex(activeCue >= 0 ? activeCue : null);
  }, [currentTime, cues]);

  // Video time update handler
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const newVtt = cuesToVtt(cues);
      
      // Upload new VTT file
      const timestamp = Date.now();
      const path = `subtitles/${subtitle?.content_id}/${subtitle?.episode_id || "main"}/${subtitle?.language_code}_edited_${timestamp}.vtt`;
      
      const { error: uploadError } = await supabase.storage
        .from("subtitles")
        .upload(path, new Blob([newVtt], { type: "text/vtt" }), {
          contentType: "text/vtt",
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from("subtitles")
        .getPublicUrl(path);
      
      // Update subtitle record
      const { error: updateError } = await supabase
        .from("subtitles")
        .update({
          subtitle_url: publicUrl,
          cdn_url: publicUrl,
          manually_edited: true,
          edited_by: user?.id,
          edited_at: new Date().toISOString(),
          speaker_labels: cues
            .filter((c) => c.speakerLabel)
            .map((c) => c.speakerLabel)
            .filter((v, i, a) => a.indexOf(v) === i),
        })
        .eq("id", subtitleId);
      
      if (updateError) throw updateError;
      
      // Log edit history
      await supabase.from("subtitle_edit_history").insert({
        subtitle_id: subtitleId,
        edited_by: user?.id,
        previous_content: originalVtt,
        new_content: newVtt,
        edit_type: "full",
      });
      
      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtitles"] });
      setHasChanges(false);
      toast.success("Subtitles saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save subtitles", {
        description: error.message,
      });
    },
  });

  // Cue editing handlers
  const updateCue = (index: number, updates: Partial<SubtitleCue>) => {
    setCues((prev) =>
      prev.map((cue, i) => (i === index ? { ...cue, ...updates } : cue))
    );
    setHasChanges(true);
  };

  const deleteCue = (index: number) => {
    setCues((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setSelectedCue(null);
  };

  const addCue = () => {
    const lastCue = cues[cues.length - 1];
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      index: cues.length,
      startTime: lastCue ? lastCue.endTime + 0.5 : currentTime,
      endTime: lastCue ? lastCue.endTime + 3 : currentTime + 3,
      text: "New subtitle",
    };
    setCues((prev) => [...prev, newCue]);
    setHasChanges(true);
    setSelectedCue(newCue);
  };

  const jumpToCue = (cue: SubtitleCue) => {
    if (videoRef.current) {
      videoRef.current.currentTime = cue.startTime;
      setSelectedCue(cue);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const isLoading = loadingSubtitle || loadingVtt;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[80vh]">
      {/* Video Player Section */}
      <div className="flex flex-col gap-4">
        <Card className="flex-1">
          <CardContent className="p-4 h-full flex flex-col">
            {/* Video */}
            <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-[300px]">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Current subtitle overlay */}
              {activeCueIndex !== null && (
                <div className="absolute bottom-8 left-0 right-0 text-center px-4">
                  <div className="inline-block bg-black/80 text-white px-4 py-2 rounded-lg max-w-[80%]">
                    {cues[activeCueIndex].speakerLabel && (
                      <span className="text-primary font-medium mr-2">
                        [{cues[activeCueIndex].speakerLabel}]:
                      </span>
                    )}
                    {cues[activeCueIndex].text}
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls */}
            <div className="flex items-center gap-2 pt-4">
              <Button variant="outline" size="icon" onClick={() => skipTime(-5)}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={togglePlayback}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => skipTime(5)}>
                <SkipForward className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {formatDisplayTime(currentTime)}
              </span>
              <div className="flex-1" />
              <Badge variant={hasChanges ? "destructive" : "secondary"}>
                {hasChanges ? "Unsaved changes" : "Saved"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Selected Cue Editor */}
        {selectedCue && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="h-4 w-4" />
                Edit Cue #{cues.findIndex((c) => c.id === selectedCue.id) + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Start Time</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedCue.startTime.toFixed(1)}
                    onChange={(e) => {
                      const index = cues.findIndex((c) => c.id === selectedCue.id);
                      const newTime = parseFloat(e.target.value) || 0;
                      updateCue(index, { startTime: newTime });
                      setSelectedCue({ ...selectedCue, startTime: newTime });
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Time</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedCue.endTime.toFixed(1)}
                    onChange={(e) => {
                      const index = cues.findIndex((c) => c.id === selectedCue.id);
                      const newTime = parseFloat(e.target.value) || 0;
                      updateCue(index, { endTime: newTime });
                      setSelectedCue({ ...selectedCue, endTime: newTime });
                    }}
                  />
                </div>
              </div>

              {/* Speaker Label */}
              <div>
                <label className="text-xs text-muted-foreground">Speaker Label (optional)</label>
                <Input
                  placeholder="e.g., John, Narrator"
                  value={selectedCue.speakerLabel || ""}
                  onChange={(e) => {
                    const index = cues.findIndex((c) => c.id === selectedCue.id);
                    updateCue(index, { speakerLabel: e.target.value || undefined });
                    setSelectedCue({ ...selectedCue, speakerLabel: e.target.value || undefined });
                  }}
                />
              </div>

              {/* Text */}
              <div>
                <label className="text-xs text-muted-foreground">Subtitle Text</label>
                <Textarea
                  value={selectedCue.text}
                  rows={2}
                  onChange={(e) => {
                    const index = cues.findIndex((c) => c.id === selectedCue.id);
                    updateCue(index, { text: e.target.value });
                    setSelectedCue({ ...selectedCue, text: e.target.value });
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => jumpToCue(selectedCue)}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const index = cues.findIndex((c) => c.id === selectedCue.id);
                    deleteCue(index);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cue List Section */}
      <Card className="flex flex-col">
        <CardHeader className="py-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Subtitle Cues</CardTitle>
            <CardDescription className="text-xs">
              {cues.length} cues • {subtitle?.language_label}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addCue}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-1 p-3">
              {cues.map((cue, index) => (
                <div
                  key={cue.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    activeCueIndex === index
                      ? "bg-primary/10 border-primary"
                      : selectedCue?.id === cue.id
                      ? "bg-muted border-border"
                      : "hover:bg-muted/50 border-transparent"
                  }`}
                  onClick={() => {
                    setSelectedCue(cue);
                    jumpToCue(cue);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {(index + 1).toString().padStart(3, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        {formatDisplayTime(cue.startTime)} → {formatDisplayTime(cue.endTime)}
                        {cue.speakerLabel && (
                          <Badge variant="outline" className="text-xs py-0">
                            <User className="h-3 w-3 mr-1" />
                            {cue.speakerLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{cue.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
