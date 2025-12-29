import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Languages, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface SubtitleTranslatorProps {
  contentId: string;
  episodeId?: string;
  title: string;
  onComplete?: () => void;
}

interface SubtitleRecord {
  id: string;
  language_code: string;
  language_label: string;
  subtitle_url: string;
  is_translated: boolean | null;
}

interface TranslationStatus {
  language: string;
  status: "pending" | "translating" | "success" | "error";
  error?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

export function SubtitleTranslator({ 
  contentId, 
  episodeId, 
  title,
  onComplete 
}: SubtitleTranslatorProps) {
  const [existingSubtitles, setExistingSubtitles] = useState<SubtitleRecord[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>("");
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationStatuses, setTranslationStatuses] = useState<TranslationStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

  // Fetch existing subtitles
  useEffect(() => {
    const fetchSubtitles = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from("subtitles")
          .select("id, language_code, language_label, subtitle_url, is_translated")
          .eq("content_id", contentId);
        
        if (episodeId) {
          query = query.eq("episode_id", episodeId);
        } else {
          query = query.is("episode_id", null);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setExistingSubtitles(data || []);
        
        // Auto-select first non-translated subtitle as source
        const originalSubtitle = data?.find(s => !s.is_translated);
        if (originalSubtitle) {
          setSourceLanguage(originalSubtitle.language_code);
        }
      } catch (error) {
        console.error("Error fetching subtitles:", error);
        toast.error("Failed to load subtitles");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubtitles();
  }, [contentId, episodeId]);

  // Get available source languages (existing subtitles)
  const sourceOptions = existingSubtitles.map(s => ({
    code: s.language_code,
    label: SUPPORTED_LANGUAGES.find(l => l.code === s.language_code)?.label || s.language_label,
    flag: SUPPORTED_LANGUAGES.find(l => l.code === s.language_code)?.flag || "🏳️"
  }));

  // Get available target languages (not already existing)
  const existingCodes = existingSubtitles.map(s => s.language_code);
  const targetOptions = SUPPORTED_LANGUAGES.filter(
    l => l.code !== sourceLanguage && !existingCodes.includes(l.code)
  );

  const handleTargetToggle = (code: string) => {
    setTargetLanguages(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleSelectAllMissing = () => {
    setTargetLanguages(targetOptions.map(l => l.code));
  };

  const handleTranslate = async () => {
    if (!sourceLanguage || targetLanguages.length === 0) {
      toast.error("Please select source and target languages");
      return;
    }

    const sourceSubtitle = existingSubtitles.find(s => s.language_code === sourceLanguage);
    if (!sourceSubtitle) {
      toast.error("Source subtitle not found");
      return;
    }

    setIsTranslating(true);
    setOverallProgress(0);
    
    // Initialize statuses
    const initialStatuses: TranslationStatus[] = targetLanguages.map(lang => ({
      language: lang,
      status: "pending"
    }));
    setTranslationStatuses(initialStatuses);

    let completed = 0;
    const total = targetLanguages.length;

    for (const targetCode of targetLanguages) {
      const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetCode);
      
      // Update status to translating
      setTranslationStatuses(prev => 
        prev.map(s => s.language === targetCode ? { ...s, status: "translating" } : s)
      );

      try {
        const { data, error } = await supabase.functions.invoke("translate-subtitles", {
          body: {
            sourceSubtitleId: sourceSubtitle.id,
            targetLanguageCode: targetCode,
            targetLanguageLabel: targetLang?.label || targetCode,
            contentId,
            episodeId,
            title
          }
        });

        if (error) throw error;

        // Update status to success
        setTranslationStatuses(prev => 
          prev.map(s => s.language === targetCode ? { ...s, status: "success" } : s)
        );
      } catch (error: any) {
        console.error(`Error translating to ${targetCode}:`, error);
        
        // Update status to error
        setTranslationStatuses(prev => 
          prev.map(s => s.language === targetCode 
            ? { ...s, status: "error", error: error.message || "Translation failed" } 
            : s
          )
        );
      }

      completed++;
      setOverallProgress(Math.round((completed / total) * 100));
    }

    setIsTranslating(false);
    
    const successCount = translationStatuses.filter(s => s.status === "success").length;
    if (successCount > 0) {
      toast.success(`Translated to ${successCount} language(s) successfully`);
      onComplete?.();
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (existingSubtitles.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Languages className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No subtitles available to translate from.</p>
            <p className="text-sm">Upload or generate subtitles first.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Translation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Language Selection */}
        <div className="space-y-2">
          <Label>Translate from</Label>
          <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
            <SelectTrigger className="bg-secondary">
              <SelectValue placeholder="Select source language" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map(opt => (
                <SelectItem key={opt.code} value={opt.code}>
                  <span className="flex items-center gap-2">
                    <span>{opt.flag}</span>
                    <span>{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Arrow */}
        {sourceLanguage && (
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        {/* Target Languages Selection */}
        {sourceLanguage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Translate to</Label>
              {targetOptions.length > 0 && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={handleSelectAllMissing}
                  className="h-auto p-0 text-xs"
                >
                  Select all missing ({targetOptions.length})
                </Button>
              )}
            </div>
            
            {targetOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All supported languages already have subtitles!
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {targetOptions.map(lang => (
                  <div
                    key={lang.code}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg border cursor-pointer
                      transition-colors
                      ${targetLanguages.includes(lang.code) 
                        ? "bg-primary/10 border-primary" 
                        : "bg-muted/30 border-border hover:border-primary/50"
                      }
                    `}
                    onClick={() => handleTargetToggle(lang.code)}
                  >
                    <Checkbox 
                      checked={targetLanguages.includes(lang.code)}
                      onCheckedChange={() => handleTargetToggle(lang.code)}
                    />
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-sm truncate">{lang.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Translation Progress */}
        {translationStatuses.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Translation Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {translationStatuses.map(status => {
                const lang = SUPPORTED_LANGUAGES.find(l => l.code === status.language);
                return (
                  <div 
                    key={status.language}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span>{lang?.flag}</span>
                    <span className="flex-1">{lang?.label}</span>
                    {status.status === "pending" && (
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    )}
                    {status.status === "translating" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {status.status === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {status.status === "error" && (
                      <span title={status.error}>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Translate Button */}
        <Button
          onClick={handleTranslate}
          disabled={!sourceLanguage || targetLanguages.length === 0 || isTranslating}
          className="w-full gap-2"
        >
          {isTranslating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Translate to {targetLanguages.length} Language{targetLanguages.length !== 1 ? "s" : ""}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Uses AI to translate subtitles while preserving timing. No API key required.
        </p>
      </CardContent>
    </Card>
  );
}
