import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Languages, 
  Download, 
  Trash2, 
  RefreshCw, 
  Check, 
  X,
  Loader2,
  FileText
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubtitleLanguageOverviewProps {
  contentId: string;
  episodeId?: string;
  onRefresh?: () => void;
}

interface SubtitleRecord {
  id: string;
  language_code: string;
  language_label: string;
  subtitle_url: string;
  cdn_url: string | null;
  word_count: number | null;
  source_type: string | null;
  is_translated: boolean | null;
  created_at: string;
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

export function SubtitleLanguageOverview({ 
  contentId, 
  episodeId, 
  onRefresh 
}: SubtitleLanguageOverviewProps) {
  const [subtitles, setSubtitles] = useState<SubtitleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subtitleToDelete, setSubtitleToDelete] = useState<SubtitleRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSubtitles = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("subtitles")
        .select("*")
        .eq("content_id", contentId);
      
      if (episodeId) {
        query = query.eq("episode_id", episodeId);
      } else {
        query = query.is("episode_id", null);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setSubtitles(data || []);
    } catch (error) {
      console.error("Error fetching subtitles:", error);
      toast.error("Failed to load subtitles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubtitles();
  }, [contentId, episodeId]);

  const handleDelete = async () => {
    if (!subtitleToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("subtitles")
        .delete()
        .eq("id", subtitleToDelete.id);
      
      if (error) throw error;
      
      toast.success(`Deleted ${subtitleToDelete.language_label} subtitle`);
      fetchSubtitles();
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting subtitle:", error);
      toast.error("Failed to delete subtitle");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSubtitleToDelete(null);
    }
  };

  const handleDownload = (subtitle: SubtitleRecord) => {
    const url = subtitle.cdn_url || subtitle.subtitle_url;
    window.open(url, "_blank");
  };

  const getSubtitleForLanguage = (langCode: string) => {
    return subtitles.find(s => s.language_code === langCode);
  };

  const availableCount = subtitles.length;
  const totalLanguages = SUPPORTED_LANGUAGES.length;
  const coveragePercent = Math.round((availableCount / totalLanguages) * 100);

  const getSourceBadge = (subtitle: SubtitleRecord) => {
    const sourceType = subtitle.source_type || "manual";
    const isTranslated = subtitle.is_translated;
    
    if (isTranslated) {
      return <Badge variant="secondary" className="text-xs">Translated</Badge>;
    }
    
    switch (sourceType) {
      case "generated":
        return <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">Generated</Badge>;
      case "manual":
      default:
        return <Badge variant="outline" className="text-xs">Manual</Badge>;
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

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Subtitle Languages
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchSubtitles}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Coverage Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Language Coverage</span>
              <span className="font-medium">{availableCount}/{totalLanguages} languages</span>
            </div>
            <Progress value={coveragePercent} className="h-2" />
          </div>

          {/* Language Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const subtitle = getSubtitleForLanguage(lang.code);
              const hasSubtitle = !!subtitle;
              
              return (
                <div
                  key={lang.code}
                  className={`
                    relative p-3 rounded-lg border transition-colors
                    ${hasSubtitle 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-muted/30 border-border"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-xs font-medium truncate w-full text-center">
                      {lang.label}
                    </span>
                    
                    {hasSubtitle ? (
                      <div className="flex flex-col items-center gap-1 w-full">
                        <Check className="h-4 w-4 text-green-500" />
                        {subtitle.word_count && (
                          <span className="text-[10px] text-muted-foreground">
                            {subtitle.word_count.toLocaleString()} words
                          </span>
                        )}
                        {getSourceBadge(subtitle)}
                        
                        {/* Actions */}
                        <div className="flex gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDownload(subtitle)}
                            title="Download"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSubtitleToDelete(subtitle);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          {subtitles.length > 0 && (
            <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>{subtitles.filter(s => s.source_type === "manual" || !s.source_type).length} manual</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-500">●</span>
                <span>{subtitles.filter(s => s.source_type === "generated").length} generated</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-purple-500">●</span>
                <span>{subtitles.filter(s => s.is_translated).length} translated</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subtitle?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {subtitleToDelete?.language_label} subtitle? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
