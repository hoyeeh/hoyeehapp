import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Check, AlertCircle, FileText } from "lucide-react";

interface SubtitleUploaderProps {
  contentId: string;
  episodeId?: string;
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

export function SubtitleUploader({ contentId, episodeId, title, onComplete }: SubtitleUploaderProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("fra");
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'vtt' && extension !== 'srt') {
        toast.error("Please select a VTT or SRT file");
        return;
      }
      setSelectedFile(file);
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const convertSrtToVtt = (srtContent: string): string => {
    // Convert SRT format to VTT
    let vttContent = "WEBVTT\n\n";
    
    // Remove BOM if present
    const cleanSrt = srtContent.replace(/^\uFEFF/, '');
    
    // Split into blocks
    const blocks = cleanSrt.trim().split(/\n\n+/);
    
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;
      
      // Skip the sequence number (first line)
      // Get timing line (second line) and convert commas to dots
      const timingLine = lines[1].replace(/,/g, '.');
      
      // Get subtitle text (remaining lines)
      const subtitleText = lines.slice(2).join('\n');
      
      vttContent += `${timingLine}\n${subtitleText}\n\n`;
    }
    
    return vttContent;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a subtitle file");
      return;
    }

    setIsUploading(true);
    setStatus("uploading");
    setErrorMessage("");

    try {
      // Read file content
      let fileContent = await selectedFile.text();
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      // Convert SRT to VTT if needed
      if (extension === 'srt') {
        fileContent = convertSrtToVtt(fileContent);
      }

      // Validate VTT content
      if (!fileContent.includes('WEBVTT')) {
        throw new Error("Invalid subtitle file format");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = episodeId 
        ? `${contentId}/${episodeId}/${selectedLanguage}_${timestamp}.vtt`
        : `${contentId}/${selectedLanguage}_${timestamp}.vtt`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('subtitles')
        .upload(fileName, new Blob([fileContent], { type: 'text/vtt' }), {
          contentType: 'text/vtt',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('subtitles')
        .getPublicUrl(fileName);

      const subtitleUrl = urlData.publicUrl;

      // Count words in subtitle
      const wordCount = fileContent.split(/\s+/).filter(w => 
        w.length > 0 && !w.match(/^\d+$/) && !w.includes('-->') && w !== 'WEBVTT'
      ).length;

      const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

      // Check if subtitle already exists for this content/episode/language
      const { data: existingSubtitle } = await supabase
        .from('subtitles')
        .select('id')
        .eq('content_id', contentId)
        .eq('language_code', selectedLanguage)
        .eq('episode_id', episodeId || null)
        .maybeSingle();

      if (existingSubtitle) {
        // Update existing
        const { error: updateError } = await supabase
          .from('subtitles')
          .update({
            subtitle_url: subtitleUrl,
            cdn_url: subtitleUrl,
            word_count: wordCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSubtitle.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('subtitles')
          .insert({
            content_id: contentId,
            episode_id: episodeId || null,
            language_code: selectedLanguage,
            language_label: selectedLang?.label || selectedLanguage,
            subtitle_url: subtitleUrl,
            cdn_url: subtitleUrl,
            word_count: wordCount
          });

        if (insertError) throw insertError;
      }

      setStatus("success");
      toast.success(`${selectedLang?.label} subtitles uploaded successfully!`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onComplete?.();
    } catch (error: any) {
      console.error("Subtitle upload error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to upload subtitles");
      toast.error(`Failed to upload subtitles: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Upload Subtitles</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Upload a VTT or SRT subtitle file for "{title}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isUploading}>
            <SelectTrigger className="w-40 bg-secondary">
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
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".vtt,.srt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2 flex-1"
          >
            <FileText className="h-4 w-4" />
            {selectedFile ? selectedFile.name : "Select File"}
          </Button>
        </div>

        {selectedFile && (
          <Button 
            type="button"
            onClick={handleUpload} 
            disabled={isUploading}
            className="w-full gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Subtitle
              </>
            )}
          </Button>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4" />
            <span>Subtitles uploaded and saved successfully!</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Supported formats: VTT (WebVTT), SRT (SubRip). SRT files will be automatically converted to VTT.
        </p>
      </CardContent>
    </Card>
  );
}
