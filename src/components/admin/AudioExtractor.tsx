import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Music, Loader2, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AudioExtractorProps {
  contentId: string;
  episodeId?: string;
  videoUrl: string;
  title?: string;
  onExtracted?: (audioUrl: string) => void;
}

const OUTPUT_FORMATS = [
  { value: "mp3", label: "MP3 (Recommended)", description: "Smallest size, best compatibility" },
  { value: "aac", label: "AAC", description: "Good quality, smaller than WAV" },
  { value: "wav", label: "WAV", description: "Lossless quality, larger file" },
];

export function AudioExtractor({ contentId, episodeId, videoUrl, title, onExtracted }: AudioExtractorProps) {
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [isExtracting, setIsExtracting] = useState(false);
  const [status, setStatus] = useState<"idle" | "extracting" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!videoUrl) {
      toast.error("No video URL provided");
      return;
    }

    setIsExtracting(true);
    setStatus("extracting");
    setProgress(10);
    setErrorMessage(null);

    try {
      // Simulate progress during extraction
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 3000);

      const { data, error } = await supabase.functions.invoke("extract-audio", {
        body: {
          videoUrl,
          contentId,
          episodeId,
          outputFormat,
        },
      });

      clearInterval(progressInterval);

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setProgress(100);
      setStatus("success");
      setExtractedAudioUrl(data.audioUrl);
      
      toast.success(`Audio extracted successfully (${data.fileSizeMb} MB)`);
      
      if (onExtracted) {
        onExtracted(data.audioUrl);
      }
    } catch (error: any) {
      console.error("Audio extraction error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to extract audio");
      toast.error("Failed to extract audio: " + (error.message || "Unknown error"));
    } finally {
      setIsExtracting(false);
    }
  };

  const copyAudioUrl = () => {
    if (extractedAudioUrl) {
      navigator.clipboard.writeText(extractedAudioUrl);
      toast.success("Audio URL copied to clipboard");
    }
  };

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Music className="h-4 w-4 text-blue-500" />
          Extract Audio from Video
        </CardTitle>
        <CardDescription className="text-xs">
          Extract audio track for faster subtitle generation on large videos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {title && (
          <p className="text-sm text-muted-foreground truncate">
            Video: {title}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={outputFormat} onValueChange={setOutputFormat} disabled={isExtracting}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Output format" />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_FORMATS.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  <div className="flex flex-col">
                    <span>{format.label}</span>
                    <span className="text-xs text-muted-foreground">{format.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleExtract} 
            disabled={isExtracting || !videoUrl}
            className="flex-1"
            variant={status === "success" ? "outline" : "default"}
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : status === "success" ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Extract Again
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Extract Audio
              </>
            )}
          </Button>
        </div>

        {status === "extracting" && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Extracting audio... This may take a few minutes for large videos.
            </p>
          </div>
        )}

        {status === "success" && extractedAudioUrl && (
          <div className="space-y-2 p-3 bg-green-500/10 rounded-md border border-green-500/20">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Audio extracted successfully!</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={extractedAudioUrl}
                readOnly
                className="flex-1 text-xs bg-background/50 px-2 py-1 rounded border truncate"
              />
              <Button size="sm" variant="outline" onClick={copyAudioUrl}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this audio URL for subtitle generation instead of the video URL.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{errorMessage}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> For videos larger than 500MB, extract audio first. 
          The extracted audio file will be much smaller (typically 10-50MB) and suitable for subtitle generation.
        </p>
      </CardContent>
    </Card>
  );
}
