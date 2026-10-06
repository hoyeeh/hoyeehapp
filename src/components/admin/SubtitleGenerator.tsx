import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Languages, Loader2, Check, AlertCircle, Subtitles, Music, ChevronDown, Info } from "lucide-react";
import { AudioExtractor } from "./AudioExtractor";

interface SubtitleGeneratorProps {
  contentId: string;
  episodeId?: string;
  videoUrl: string | null;
  title: string;
  onComplete?: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: "fra", label: "French", flag: "🇫🇷" },
  { code: "eng", label: "English", flag: "🇬🇧" },
  { code: "spa", label: "Spanish", flag: "🇪🇸" },
  { code: "ara", label: "Arabic", flag: "🇸🇦" },
  { code: "deu", label: "German", flag: "🇩🇪" },
  { code: "ita", label: "Italian", flag: "🇮🇹" },
  { code: "por", label: "Portuguese", flag: "🇵🇹" },
  { code: "hin", label: "Hindi", flag: "🇮🇳" },
  { code: "zho", label: "Chinese", flag: "🇨🇳" },
  { code: "jpn", label: "Japanese", flag: "🇯🇵" },
];

// Export for use in other components
export { SUPPORTED_LANGUAGES };

export function SubtitleGenerator({ contentId, episodeId, videoUrl, title, onComplete }: SubtitleGeneratorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("fra");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [showExtractAudio, setShowExtractAudio] = useState(false);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [suggestExtractAudio, setSuggestExtractAudio] = useState(false);

  const handleGenerate = async () => {
    const urlToUse = customAudioUrl || videoUrl;
    
    if (!urlToUse) {
      toast.error("No video/audio URL available for this content");
      return;
    }

    setIsGenerating(true);
    setStatus("processing");
    setProgress(10);
    setErrorMessage("");
    setSuggestExtractAudio(false);

    try {
      setProgress(30);
      
      const { data, error } = await supabase.functions.invoke("generate-subtitles", {
        body: {
          contentId,
          episodeId,
          audioUrl: urlToUse,
          languageCode: selectedLanguage,
        },
      });

      setProgress(90);

      if (error) throw error;

      if (data?.success) {
        setStatus("success");
        setProgress(100);
        toast.success(`${SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label} subtitles generated successfully!`);
        onComplete?.();
      } else {
        // Check if the error suggests using audio extraction
        if (data?.suggestExtractAudio) {
          setSuggestExtractAudio(true);
          setShowExtractAudio(true);
        }
        throw new Error(data?.error || "Unknown error occurred");
      }
    } catch (error: any) {
      console.error("Subtitle generation error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to generate subtitles");
      toast.error(`Failed to generate subtitles: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAudioExtracted = (audioUrl: string) => {
    setCustomAudioUrl(audioUrl);
    setSuggestExtractAudio(false);
    toast.success("Audio extracted! Click 'Generate' to create subtitles from the audio.");
  };

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Subtitles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Generate Subtitles</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Generate timed subtitles for "{title}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio extraction collapsible */}
        <Collapsible open={showExtractAudio} onOpenChange={setShowExtractAudio}>
          <CollapsibleTrigger asChild>
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              className={`w-full justify-between ${suggestExtractAudio ? 'border-amber-500 bg-amber-500/10' : ''}`}
            >
              <span className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                {suggestExtractAudio ? "Extract Audio First (Recommended for Large Videos)" : "Extract Audio from Video"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showExtractAudio ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {videoUrl && (
              <AudioExtractor
                contentId={contentId}
                episodeId={episodeId}
                videoUrl={videoUrl}
                title={title}
                onExtracted={handleAudioExtracted}
              />
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Show custom audio URL if set */}
        {customAudioUrl && (
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
            <Info className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Using extracted audio for subtitle generation
            </span>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="ml-auto h-6 text-xs"
              onClick={() => setCustomAudioUrl(null)}
            >
              Use original video
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isGenerating}>
            <SelectTrigger className="flex-1 bg-secondary">
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
          
          <Button 
            type="button"
            onClick={handleGenerate} 
            disabled={isGenerating || (!videoUrl && !customAudioUrl)}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {status === "processing" && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Processing audio and generating subtitles...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4" />
            <span>Subtitles generated and saved successfully!</span>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
            {suggestExtractAudio && (
              <p className="text-xs text-muted-foreground">
                💡 The video file is too large. Use the "Extract Audio" option above to create a smaller audio file first.
              </p>
            )}
          </div>
        )}

        {!videoUrl && !customAudioUrl && (
          <Badge variant="outline" className="text-amber-500 border-amber-500">
            No video URL - upload a video first
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
