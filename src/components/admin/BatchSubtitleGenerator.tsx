import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContent } from "@/lib/fetchAllContent";
import { toast } from "sonner";
import { Languages, Loader2, Check, X, Play, Pause, Film, Tv, ChevronDown, ChevronRight } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface EpisodeItem {
  id: string;
  title: string;
  episode_number: number;
  video_url: string | null;
  thumbnail_url: string | null;
  season_id: string;
  season_number: number;
  content_id: string;
  content_title: string;
}

interface ProcessingStatus {
  id: string;
  title: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  type: "movie" | "episode";
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
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("movies");
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());

  // Fetch all movies with video URLs
  const { data: allContent = [], isLoading: loadingMovies } = useQuery({
    queryKey: ["batch-subtitle-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, content_type, video_url, thumbnail_url")
        .eq("content_type", "movie")
        .not("video_url", "is", null)
        .order("title");

      if (error) throw error;
      return data as ContentItem[];
    },
  });

  // Fetch all episodes with video URLs
  const { data: allEpisodes = [], isLoading: loadingEpisodes } = useQuery({
    queryKey: ["batch-subtitle-episodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("episodes")
        .select(`
          id, 
          title, 
          episode_number, 
          video_url, 
          thumbnail_url,
          season_id,
          season:seasons!inner (
            season_number,
            content_id,
            content:content!inner (
              id,
              title
            )
          )
        `)
        .not("video_url", "is", null)
        .order("episode_number");

      if (error) throw error;
      
      // Flatten the data
      return (data || []).map((ep: any) => ({
        id: ep.id,
        title: ep.title,
        episode_number: ep.episode_number,
        video_url: ep.video_url,
        thumbnail_url: ep.thumbnail_url,
        season_id: ep.season_id,
        season_number: ep.season.season_number,
        content_id: ep.season.content.id,
        content_title: ep.season.content.title,
      })) as EpisodeItem[];
    },
  });

  // Group episodes by TV show
  const episodesByShow = allEpisodes.reduce((acc, ep) => {
    if (!acc[ep.content_id]) {
      acc[ep.content_id] = {
        content_id: ep.content_id,
        content_title: ep.content_title,
        episodes: [],
      };
    }
    acc[ep.content_id].episodes.push(ep);
    return acc;
  }, {} as Record<string, { content_id: string; content_title: string; episodes: EpisodeItem[] }>);

  const moviesWithVideo = allContent.filter(c => c.video_url);

  const handleSelectAllMovies = () => {
    if (selectedContent.size === moviesWithVideo.length) {
      setSelectedContent(new Set());
    } else {
      setSelectedContent(new Set(moviesWithVideo.map(c => c.id)));
    }
  };

  const handleSelectAllEpisodes = () => {
    if (selectedEpisodes.size === allEpisodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(allEpisodes.map(e => e.id)));
    }
  };

  const handleSelectShowEpisodes = (showId: string) => {
    const showEpisodes = episodesByShow[showId]?.episodes || [];
    const allSelected = showEpisodes.every(ep => selectedEpisodes.has(ep.id));
    
    const newSelected = new Set(selectedEpisodes);
    if (allSelected) {
      showEpisodes.forEach(ep => newSelected.delete(ep.id));
    } else {
      showEpisodes.forEach(ep => newSelected.add(ep.id));
    }
    setSelectedEpisodes(newSelected);
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

  const handleToggleEpisode = (id: string) => {
    const newSelected = new Set(selectedEpisodes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEpisodes(newSelected);
  };

  const toggleShowExpanded = (showId: string) => {
    const newExpanded = new Set(expandedShows);
    if (newExpanded.has(showId)) {
      newExpanded.delete(showId);
    } else {
      newExpanded.add(showId);
    }
    setExpandedShows(newExpanded);
  };

  const processItem = async (item: { id: string; video_url: string; contentId: string; episodeId?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-subtitles", {
        body: {
          contentId: item.contentId,
          episodeId: item.episodeId,
          audioUrl: item.video_url,
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
    const moviesToProcess = activeTab === "movies" 
      ? moviesWithVideo.filter(c => selectedContent.has(c.id)).map(m => ({
          id: m.id,
          title: m.title,
          video_url: m.video_url!,
          contentId: m.id,
          type: "movie" as const,
        }))
      : [];

    const episodesToProcess = activeTab === "episodes"
      ? allEpisodes.filter(e => selectedEpisodes.has(e.id)).map(e => ({
          id: e.id,
          title: `${e.content_title} - S${e.season_number}E${e.episode_number}: ${e.title}`,
          video_url: e.video_url!,
          contentId: e.content_id,
          episodeId: e.id,
          type: "episode" as const,
        }))
      : [];

    const itemsToProcess = [...moviesToProcess, ...episodesToProcess];
    
    if (itemsToProcess.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setCurrentIndex(0);
    
    const initialStatus: ProcessingStatus[] = itemsToProcess.map(item => ({
      id: item.id,
      title: item.title,
      status: "pending",
      type: item.type,
    }));
    setProcessingStatus(initialStatus);

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (isPaused) {
        setCurrentIndex(i);
        return;
      }

      const item = itemsToProcess[i];
      
      setProcessingStatus(prev => 
        prev.map((s, idx) => idx === i ? { ...s, status: "processing" } : s)
      );

      const result = await processItem(item);

      setProcessingStatus(prev =>
        prev.map((s, idx) => 
          idx === i 
            ? { ...s, status: result.success ? "success" : "error", error: result.error }
            : s
        )
      );

      // Small delay between requests to avoid rate limiting
      if (i < itemsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsProcessing(false);
    const successCount = processingStatus.filter(s => s.status === "success").length + 1;
    toast.success(`Batch processing complete! ${successCount}/${itemsToProcess.length} succeeded`);
  };

  const pauseProcessing = () => {
    setIsPaused(true);
  };

  const successCount = processingStatus.filter(s => s.status === "success").length;
  const errorCount = processingStatus.filter(s => s.status === "error").length;
  const totalCount = processingStatus.length;
  const progressPercent = totalCount > 0 ? ((successCount + errorCount) / totalCount) * 100 : 0;

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);
  const isLoading = loadingMovies || loadingEpisodes;

  const currentSelection = activeTab === "movies" ? selectedContent.size : selectedEpisodes.size;

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
              Generate subtitles for multiple movies or episodes at once
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">
              {moviesWithVideo.length} movies
            </Badge>
            <Badge variant="outline">
              {allEpisodes.length} episodes
            </Badge>
          </div>
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

          <Badge variant="secondary">
            {currentSelection} selected
          </Badge>

          <div className="flex-1" />

          {!isProcessing ? (
            <Button onClick={startBatchProcessing} disabled={currentSelection === 0} className="gap-2">
              <Play className="h-4 w-4" />
              Start Batch Processing
            </Button>
          ) : (
            <Button onClick={pauseProcessing} variant="outline" className="gap-2">
              <Pause className="h-4 w-4" />
              Pause
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

        {/* Tabs for Movies / Episodes */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="movies" className="gap-2" disabled={isProcessing}>
              <Film className="h-4 w-4" />
              Movies ({moviesWithVideo.length})
            </TabsTrigger>
            <TabsTrigger value="episodes" className="gap-2" disabled={isProcessing}>
              <Tv className="h-4 w-4" />
              Episodes ({allEpisodes.length})
            </TabsTrigger>
          </TabsList>

          {/* Movies Tab */}
          <TabsContent value="movies" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="sm" onClick={handleSelectAllMovies} disabled={isProcessing}>
                {selectedContent.size === moviesWithVideo.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {moviesWithVideo.map((content) => {
                    const status = processingStatus.find(s => s.id === content.id);
                    
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
                        </div>

                        {status && <StatusBadge status={status.status} />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Episodes Tab */}
          <TabsContent value="episodes" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="sm" onClick={handleSelectAllEpisodes} disabled={isProcessing}>
                {selectedEpisodes.size === allEpisodes.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {Object.values(episodesByShow).map((show) => {
                    const isExpanded = expandedShows.has(show.content_id);
                    const selectedInShow = show.episodes.filter(ep => selectedEpisodes.has(ep.id)).length;
                    const allSelected = selectedInShow === show.episodes.length;
                    
                    return (
                      <Collapsible key={show.content_id} open={isExpanded}>
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div 
                              className="flex items-center gap-3 p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                              onClick={() => toggleShowExpanded(show.content_id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <Tv className="h-4 w-4 text-primary" />
                              <span className="font-medium flex-1">{show.content_title}</span>
                              <Badge variant="secondary">{selectedInShow}/{show.episodes.length}</Badge>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectShowEpisodes(show.content_id);
                                }}
                                disabled={isProcessing}
                              >
                                {allSelected ? "Deselect" : "Select All"}
                              </Button>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-2 space-y-1 bg-background">
                              {show.episodes.map((episode) => {
                                const status = processingStatus.find(s => s.id === episode.id);
                                
                                return (
                                  <div
                                    key={episode.id}
                                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                      selectedEpisodes.has(episode.id) ? "bg-secondary/50" : ""
                                    }`}
                                  >
                                    <Checkbox
                                      checked={selectedEpisodes.has(episode.id)}
                                      onCheckedChange={() => handleToggleEpisode(episode.id)}
                                      disabled={isProcessing}
                                    />
                                    
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">
                                        <span className="text-muted-foreground">S{episode.season_number}E{episode.episode_number}:</span>{" "}
                                        {episode.title}
                                      </p>
                                    </div>

                                    {status && <StatusBadge status={status.status} />}
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ProcessingStatus["status"] }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pending</Badge>;
    case "processing":
      return (
        <Badge className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "success":
      return (
        <Badge variant="outline" className="text-green-500 border-green-500 gap-1">
          <Check className="h-3 w-3" />
          Done
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <X className="h-3 w-3" />
          Failed
        </Badge>
      );
  }
}
