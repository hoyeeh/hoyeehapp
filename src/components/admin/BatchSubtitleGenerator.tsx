import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Languages, Loader2, Check, X, Play, Pause, AlertCircle, Film, Tv } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface ProcessingStatus {
  contentId: string;
  title: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "fra", label: "French", flag: "🇫🇷" },
  { code: "eng", label: "English", flag: "🇬🇧" },
  { code: "spa", label: "Spanish", flag: "🇪🇸" },
  { code: "deu", label: "German", flag: "🇩🇪" },
];

export function BatchSubtitleGenerator() {
  const [selectedLanguage, setSelectedLanguage] = useState("fra");
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();

  // Fetch all content with video URLs
  const { data: allContent = [], isLoading } = useQuery({
    queryKey: ["batch-subtitle-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, content_type, video_url, thumbnail_url")
        .not("video_url", "is", null)
        .order("title");

      if (error) throw error;
      return data as ContentItem[];
    },
  });

  const moviesWithVideo = allContent.filter(c => c.content_type === "movie" && c.video_url);

  const handleSelectAll = () => {
    if (selectedContent.size === moviesWithVideo.length) {
      setSelectedContent(new Set());
    } else {
      setSelectedContent(new Set(moviesWithVideo.map(c => c.id)));
    }
  };

  const handleToggleContent = (id: string) => {
    const newSelected = new Set(selectedContent);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContent(newSelected);
  };

  const processContent = async (content: ContentItem) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-subtitles", {
        body: {
          contentId: content.id,
          audioUrl: content.video_url,
          languageCode: selectedLanguage,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Unknown error");

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const startBatchProcessing = async () => {
    const contentToProcess = moviesWithVideo.filter(c => selectedContent.has(c.id));
    
    if (contentToProcess.length === 0) {
      toast.error("Please select at least one content item");
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setCurrentIndex(0);
    
    const initialStatus: ProcessingStatus[] = contentToProcess.map(c => ({
      contentId: c.id,
      title: c.title,
      status: "pending",
    }));
    setProcessingStatus(initialStatus);

    for (let i = 0; i < contentToProcess.length; i++) {
      // Check if paused
      if (isPaused) {
        setCurrentIndex(i);
        return;
      }

      const content = contentToProcess[i];
      
      setProcessingStatus(prev => 
        prev.map((s, idx) => idx === i ? { ...s, status: "processing" } : s)
      );

      const result = await processContent(content);

      setProcessingStatus(prev =>
        prev.map((s, idx) => 
          idx === i 
            ? { ...s, status: result.success ? "success" : "error", error: result.error }
            : s
        )
      );

      // Small delay between requests to avoid rate limiting
      if (i < contentToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsProcessing(false);
    const successCount = processingStatus.filter(s => s.status === "success").length;
    toast.success(`Batch processing complete! ${successCount}/${contentToProcess.length} succeeded`);
  };

  const pauseProcessing = () => {
    setIsPaused(true);
  };

  const resumeProcessing = async () => {
    setIsPaused(false);
    // Continue from where we left off
    const contentToProcess = moviesWithVideo.filter(c => selectedContent.has(c.id));
    
    for (let i = currentIndex; i < contentToProcess.length; i++) {
      if (isPaused) {
        setCurrentIndex(i);
        return;
      }

      const content = contentToProcess[i];
      
      setProcessingStatus(prev => 
        prev.map((s, idx) => idx === i ? { ...s, status: "processing" } : s)
      );

      const result = await processContent(content);

      setProcessingStatus(prev =>
        prev.map((s, idx) => 
          idx === i 
            ? { ...s, status: result.success ? "success" : "error", error: result.error }
            : s
        )
      );

      if (i < contentToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsProcessing(false);
  };

  const successCount = processingStatus.filter(s => s.status === "success").length;
  const errorCount = processingStatus.filter(s => s.status === "error").length;
  const totalCount = processingStatus.length;
  const progressPercent = totalCount > 0 ? ((successCount + errorCount) / totalCount) * 100 : 0;

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Batch Subtitle Generation
            </CardTitle>
            <CardDescription>
              Generate subtitles for multiple content items at once
            </CardDescription>
          </div>
          <Badge variant="outline">
            {moviesWithVideo.length} movies with video
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isProcessing}>
            <SelectTrigger className="w-48 bg-secondary">
              <SelectValue>
                {selectedLang && (
                  <span className="flex items-center gap-2">
                    <span>{selectedLang.flag}</span>
                    <span>{selectedLang.label}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleSelectAll} disabled={isProcessing}>
            {selectedContent.size === moviesWithVideo.length ? "Deselect All" : "Select All"}
          </Button>

          <Badge variant="secondary">
            {selectedContent.size} selected
          </Badge>

          <div className="flex-1" />

          {!isProcessing ? (
            <Button onClick={startBatchProcessing} disabled={selectedContent.size === 0} className="gap-2">
              <Play className="h-4 w-4" />
              Start Batch Processing
            </Button>
          ) : (
            <Button onClick={isPaused ? resumeProcessing : pauseProcessing} variant="outline" className="gap-2">
              {isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          )}
        </div>

        {/* Progress */}
        {processingStatus.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {successCount + errorCount}/{totalCount}</span>
              <span className="text-muted-foreground">
                <span className="text-green-500">{successCount} success</span>
                {errorCount > 0 && <span className="text-destructive ml-2">{errorCount} failed</span>}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Content Selection Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-2">
              {moviesWithVideo.map((content) => {
                const status = processingStatus.find(s => s.contentId === content.id);
                
                return (
                  <div
                    key={content.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedContent.has(content.id) ? "bg-secondary/50 border-primary/50" : "border-border"
                    }`}
                  >
                    <Checkbox
                      checked={selectedContent.has(content.id)}
                      onCheckedChange={() => handleToggleContent(content.id)}
                      disabled={isProcessing}
                    />
                    
                    {content.thumbnail_url ? (
                      <img 
                        src={content.thumbnail_url} 
                        alt={content.title}
                        className="w-16 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-10 bg-secondary rounded flex items-center justify-center">
                        <Film className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{content.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{content.content_type}</p>
                    </div>

                    {status && (
                      <div className="flex items-center gap-2">
                        {status.status === "pending" && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {status.status === "processing" && (
                          <Badge className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {status.status === "success" && (
                          <Badge variant="outline" className="text-green-500 border-green-500 gap-1">
                            <Check className="h-3 w-3" />
                            Done
                          </Badge>
                        )}
                        {status.status === "error" && (
                          <Badge variant="destructive" className="gap-1">
                            <X className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
