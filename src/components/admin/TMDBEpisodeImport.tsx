import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Download, Check } from "lucide-react";

interface TMDBEpisode {
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url: string | null;
  duration: number;
  air_date: string | null;
}

interface TMDBEpisodeImportProps {
  tmdbId: number;
  seasonNumber: number;
  onSelectEpisode: (episode: {
    episode_number: number;
    title: string;
    description: string;
    thumbnail_url: string;
    duration: number;
  }) => void;
}

export const TMDBEpisodeImport = ({ tmdbId, seasonNumber, onSelectEpisode }: TMDBEpisodeImportProps) => {
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [episodeSearch, setEpisodeSearch] = useState("");

  const fetchEpisodes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-seasons", {
        body: { tmdb_id: tmdbId, season_number: seasonNumber },
      });

      if (error) throw error;
      
      setEpisodes(data.episodes || []);
      if (data.episodes?.length === 0) {
        toast.info("No episodes found for this season");
      } else {
        toast.success(`Found ${data.episodes.length} episodes`);
      }
    } catch (error: any) {
      console.error("Failed to fetch episodes:", error);
      toast.error("Failed to fetch episodes from TMDB");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEpisode = (ep: TMDBEpisode) => {
    setSelectedEpisode(ep.episode_number);
    onSelectEpisode({
      episode_number: ep.episode_number,
      title: ep.title,
      description: ep.description || "",
      thumbnail_url: ep.thumbnail_url || "",
      duration: ep.duration || 0,
    });
    toast.success(`Selected: E${ep.episode_number} - ${ep.title}`);
  };

  const filteredEpisodes = episodes.filter(ep => 
    episodeSearch === "" || 
    ep.title.toLowerCase().includes(episodeSearch.toLowerCase()) ||
    ep.episode_number.toString().includes(episodeSearch)
  );

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Import Episode from TMDB</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={fetchEpisodes}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Load Episodes
        </Button>
      </div>

      {episodes.length > 0 && (
        <>
          <Input
            placeholder="Search episodes..."
            value={episodeSearch}
            onChange={(e) => setEpisodeSearch(e.target.value)}
            className="h-8 text-sm"
          />
          
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredEpisodes.map((ep) => (
              <div
                key={ep.episode_number}
                onClick={() => handleSelectEpisode(ep)}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  selectedEpisode === ep.episode_number
                    ? "bg-primary/20 border border-primary"
                    : "hover:bg-muted"
                }`}
              >
                {ep.thumbnail_url && (
                  <img
                    src={ep.thumbnail_url}
                    alt=""
                    className="w-16 h-10 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    E{ep.episode_number}: {ep.title}
                  </p>
                  {ep.duration > 0 && (
                    <p className="text-xs text-muted-foreground">{ep.duration} min</p>
                  )}
                </div>
                {selectedEpisode === ep.episode_number && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
