import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw, ChevronDown, ChevronRight, Image, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TMDBEpisode {
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url: string;
  duration: number;
}

interface TMDBSeason {
  season_number: number;
  name: string;
  overview: string;
  poster_path: string;
  air_date: string;
  episodes?: TMDBEpisode[];
}

interface ExistingSeason {
  id: string;
  season_number: number;
}

interface ExistingEpisode {
  id: string;
  episode_number: number;
  title: string;
  thumbnail_url: string | null;
  description: string | null;
}

interface TMDBImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tmdbSeasons: TMDBSeason[];
  existingSeasons: ExistingSeason[];
  existingEpisodesBySeason: Record<string, ExistingEpisode[]>;
  onConfirmImport: (options: ImportOptions) => void;
  isImporting: boolean;
}

export interface ImportOptions {
  updateExisting: boolean;
  selectedSeasons: number[];
}

export const TMDBImportPreview = ({
  open,
  onOpenChange,
  tmdbSeasons,
  existingSeasons,
  existingEpisodesBySeason,
  onConfirmImport,
  isImporting,
}: TMDBImportPreviewProps) => {
  const [updateExisting, setUpdateExisting] = useState(false);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>(
    tmdbSeasons.map(s => s.season_number)
  );
  const [expandedSeasons, setExpandedSeasons] = useState<number[]>([]);

  const existingSeasonNumbers = new Set(existingSeasons.map(s => s.season_number));

  const toggleSeason = (seasonNumber: number) => {
    setSelectedSeasons(prev =>
      prev.includes(seasonNumber)
        ? prev.filter(n => n !== seasonNumber)
        : [...prev, seasonNumber]
    );
  };

  const toggleExpandSeason = (seasonNumber: number) => {
    setExpandedSeasons(prev =>
      prev.includes(seasonNumber)
        ? prev.filter(n => n !== seasonNumber)
        : [...prev, seasonNumber]
    );
  };

  const getSeasonStatus = (seasonNumber: number) => {
    const existingSeason = existingSeasons.find(s => s.season_number === seasonNumber);
    if (!existingSeason) return "new";
    
    const tmdbSeason = tmdbSeasons.find(s => s.season_number === seasonNumber);
    const existingEps = existingEpisodesBySeason[existingSeason.id] || [];
    const tmdbEpsCount = tmdbSeason?.episodes?.length || 0;
    
    if (existingEps.length < tmdbEpsCount) return "partial";
    return "complete";
  };

  const getEpisodeStatus = (seasonNumber: number, episodeNumber: number) => {
    const existingSeason = existingSeasons.find(s => s.season_number === seasonNumber);
    if (!existingSeason) return "new";
    
    const existingEps = existingEpisodesBySeason[existingSeason.id] || [];
    const existingEp = existingEps.find(e => e.episode_number === episodeNumber);
    
    if (!existingEp) return "new";
    return "existing";
  };

  const countNewEpisodes = () => {
    let count = 0;
    tmdbSeasons.forEach(season => {
      if (!selectedSeasons.includes(season.season_number)) return;
      
      const existingSeason = existingSeasons.find(s => s.season_number === season.season_number);
      if (!existingSeason) {
        count += season.episodes?.length || 0;
      } else {
        const existingEps = existingEpisodesBySeason[existingSeason.id] || [];
        const existingEpNumbers = new Set(existingEps.map(e => e.episode_number));
        season.episodes?.forEach(ep => {
          if (!existingEpNumbers.has(ep.episode_number)) count++;
        });
      }
    });
    return count;
  };

  const countUpdateEpisodes = () => {
    if (!updateExisting) return 0;
    let count = 0;
    tmdbSeasons.forEach(season => {
      if (!selectedSeasons.includes(season.season_number)) return;
      
      const existingSeason = existingSeasons.find(s => s.season_number === season.season_number);
      if (existingSeason) {
        const existingEps = existingEpisodesBySeason[existingSeason.id] || [];
        const existingEpNumbers = new Set(existingEps.map(e => e.episode_number));
        season.episodes?.forEach(ep => {
          if (existingEpNumbers.has(ep.episode_number)) count++;
        });
      }
    });
    return count;
  };

  const handleConfirm = () => {
    onConfirmImport({ updateExisting, selectedSeasons });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            TMDB Import Preview
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="update-existing"
            checked={updateExisting}
            onCheckedChange={(checked) => setUpdateExisting(checked === true)}
          />
          <label htmlFor="update-existing" className="text-sm cursor-pointer">
            <span className="font-medium">Update existing episodes</span>
            <span className="text-muted-foreground ml-2">
              (Overwrite thumbnails & metadata from TMDB)
            </span>
          </label>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {tmdbSeasons.map(season => {
              const status = getSeasonStatus(season.season_number);
              const isSelected = selectedSeasons.includes(season.season_number);
              const isExpanded = expandedSeasons.includes(season.season_number);

              return (
                <div key={season.season_number} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-card">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSeason(season.season_number)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpandSeason(season.season_number)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Season {season.season_number}</span>
                        {season.name && season.name !== `Season ${season.season_number}` && (
                          <span className="text-muted-foreground">- {season.name}</span>
                        )}
                        <Badge
                          variant={status === "new" ? "default" : status === "partial" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {status === "new" ? "New" : status === "partial" ? "Partial" : "Complete"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {season.episodes?.length || 0} episodes
                        {season.air_date && ` • ${season.air_date.split('-')[0]}`}
                      </div>
                    </div>
                  </div>

                  {isExpanded && season.episodes && (
                    <div className="border-t border-border bg-muted/30 p-2 space-y-1">
                      {season.episodes.map(ep => {
                        const epStatus = getEpisodeStatus(season.season_number, ep.episode_number);
                        return (
                          <div
                            key={ep.episode_number}
                            className="flex items-center gap-3 p-2 rounded bg-background text-sm"
                          >
                            <div className="w-12 h-8 bg-muted rounded overflow-hidden flex-shrink-0">
                              {ep.thumbnail_url ? (
                                <img
                                  src={ep.thumbnail_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">E{ep.episode_number}</span>
                                <span className="truncate">{ep.title}</span>
                              </div>
                              {ep.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {ep.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={epStatus === "new" ? "default" : "outline"}
                              className="text-xs flex-shrink-0"
                            >
                              {epStatus === "new" ? (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  New
                                </>
                              ) : updateExisting ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Update
                                </>
                              ) : (
                                "Exists"
                              )}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {countNewEpisodes()} new episodes
            {updateExisting && countUpdateEpisodes() > 0 && (
              <>, {countUpdateEpisodes()} to update</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isImporting || selectedSeasons.length === 0}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import Selected
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
