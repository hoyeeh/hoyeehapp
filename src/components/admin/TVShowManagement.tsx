import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Film, Play, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  useSeasons, 
  useCreateSeason, 
  useUpdateSeason, 
  useDeleteSeason,
  useEpisodes,
  useCreateEpisode,
  useUpdateEpisode,
  useDeleteEpisode,
  Season,
  Episode
} from "@/hooks/useSeasons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TVShowManagementProps {
  contentId: string;
  contentTitle: string;
  tmdbId?: number | null;
  onClose: () => void;
}

const TVShowManagement = ({ contentId, contentTitle, tmdbId, onClose }: TVShowManagementProps) => {
  const { toast } = useToast();
  const { data: seasons, isLoading } = useSeasons(contentId);
  const createSeason = useCreateSeason();
  const deleteSeason = useDeleteSeason();

  const [expandedSeasons, setExpandedSeasons] = useState<string[]>([]);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [importing, setImporting] = useState(false);
  const [seasonForm, setSeasonForm] = useState({
    season_number: 1,
    title: "",
    description: "",
    thumbnail_url: "",
    year: new Date().getFullYear(),
  });

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons(prev => 
      prev.includes(seasonId) 
        ? prev.filter(id => id !== seasonId)
        : [...prev, seasonId]
    );
  };

  const handleImportFromTMDB = async () => {
    if (!tmdbId) {
      toast({ title: "No TMDB ID available for this show", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      // Fetch seasons from TMDB
      const { data: seasonsData, error: seasonsError } = await supabase.functions.invoke('tmdb-seasons', {
        body: { tmdb_id: tmdbId }
      });

      if (seasonsError) throw seasonsError;

      console.log('TMDB Seasons:', seasonsData);

      // Import each season and its episodes
      for (const tmdbSeason of seasonsData.seasons || []) {
        // Create season
        const seasonResult = await createSeason.mutateAsync({
          content_id: contentId,
          season_number: tmdbSeason.season_number,
          title: tmdbSeason.name,
          description: tmdbSeason.overview,
          thumbnail_url: tmdbSeason.poster_path,
          year: tmdbSeason.air_date ? parseInt(tmdbSeason.air_date.split('-')[0]) : null,
        });

        // Fetch episodes for this season
        const { data: episodesData } = await supabase.functions.invoke('tmdb-seasons', {
          body: { tmdb_id: tmdbId, season_number: tmdbSeason.season_number }
        });

        if (episodesData?.episodes) {
          // Create episodes
          for (const ep of episodesData.episodes) {
            await supabase.from('episodes').insert({
              season_id: seasonResult.id,
              episode_number: ep.episode_number,
              title: ep.title,
              description: ep.description,
              thumbnail_url: ep.thumbnail_url,
              duration: ep.duration || 0,
              is_premium: false,
            });
          }
        }
      }

      toast({ title: `Imported ${seasonsData.seasons?.length || 0} seasons from TMDB` });
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: "Failed to import from TMDB", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleSeasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSeason.mutateAsync({
        content_id: contentId,
        ...seasonForm,
      });
      toast({ title: "Season created successfully" });
      resetSeasonForm();
    } catch (error) {
      toast({ title: "Error saving season", variant: "destructive" });
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm("Delete this season and all its episodes?")) return;
    try {
      await deleteSeason.mutateAsync(seasonId);
      toast({ title: "Season deleted successfully" });
    } catch (error) {
      toast({ title: "Error deleting season", variant: "destructive" });
    }
  };

  const resetSeasonForm = () => {
    setShowSeasonForm(false);
    setEditingSeason(null);
    setSeasonForm({
      season_number: (seasons?.length || 0) + 1,
      title: "",
      description: "",
      thumbnail_url: "",
      year: new Date().getFullYear(),
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Manage: {contentTitle}
        </CardTitle>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-semibold">Seasons ({seasons?.length || 0})</h3>
          <div className="flex gap-2">
            {tmdbId && (
              <Button 
                variant="outline"
                onClick={handleImportFromTMDB}
                disabled={importing}
                className="gap-2"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Import from TMDB
              </Button>
            )}
            <Button 
              onClick={() => {
                resetSeasonForm();
                setSeasonForm(prev => ({ ...prev, season_number: (seasons?.length || 0) + 1 }));
                setShowSeasonForm(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Season
            </Button>
          </div>
        </div>

        {/* Season Form Dialog */}
        <Dialog open={showSeasonForm} onOpenChange={setShowSeasonForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Season</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSeasonSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Season Number</Label>
                  <Input
                    type="number"
                    value={seasonForm.season_number}
                    onChange={e => setSeasonForm(prev => ({ ...prev, season_number: parseInt(e.target.value) }))}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={seasonForm.year}
                    onChange={e => setSeasonForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label>Title (optional)</Label>
                <Input
                  value={seasonForm.title}
                  onChange={e => setSeasonForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., The Beginning"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={seasonForm.description}
                  onChange={e => setSeasonForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <Label>Thumbnail URL</Label>
                <Input
                  value={seasonForm.thumbnail_url}
                  onChange={e => setSeasonForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetSeasonForm}>Cancel</Button>
                <Button type="submit" disabled={createSeason.isPending}>
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Seasons List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading seasons...</div>
        ) : seasons?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No seasons yet. {tmdbId ? "Use 'Import from TMDB' to auto-populate seasons and episodes." : "Add the first season to get started."}
          </div>
        ) : (
          <div className="space-y-2">
            {seasons?.map(season => (
              <SeasonItem
                key={season.id}
                season={season}
                isExpanded={expandedSeasons.includes(season.id)}
                onToggle={() => toggleSeason(season.id)}
                onDelete={() => handleDeleteSeason(season.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface SeasonItemProps {
  season: Season;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

const SeasonItem = ({ season, isExpanded, onToggle, onDelete }: SeasonItemProps) => {
  const { toast } = useToast();
  const { data: episodes, isLoading } = useEpisodes(season.id);
  const createEpisode = useCreateEpisode();
  const updateEpisode = useUpdateEpisode();
  const deleteEpisode = useDeleteEpisode();

  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [episodeForm, setEpisodeForm] = useState({
    episode_number: 1,
    title: "",
    description: "",
    thumbnail_url: "",
    video_url: "",
    duration: 0,
    is_premium: false,
  });

  const handleEpisodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEpisode) {
        await updateEpisode.mutateAsync({
          id: editingEpisode.id,
          ...episodeForm,
        });
        toast({ title: "Episode updated" });
      } else {
        await createEpisode.mutateAsync({
          season_id: season.id,
          ...episodeForm,
        });
        toast({ title: "Episode created" });
      }
      resetEpisodeForm();
    } catch (error) {
      toast({ title: "Error saving episode", variant: "destructive" });
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm("Delete this episode?")) return;
    try {
      await deleteEpisode.mutateAsync(episodeId);
      toast({ title: "Episode deleted" });
    } catch (error) {
      toast({ title: "Error deleting episode", variant: "destructive" });
    }
  };

  const resetEpisodeForm = () => {
    setShowEpisodeForm(false);
    setEditingEpisode(null);
    setEpisodeForm({
      episode_number: (episodes?.length || 0) + 1,
      title: "",
      description: "",
      thumbnail_url: "",
      video_url: "",
      duration: 0,
      is_premium: false,
    });
  };

  const startEditEpisode = (episode: Episode) => {
    setEditingEpisode(episode);
    setEpisodeForm({
      episode_number: episode.episode_number,
      title: episode.title,
      description: episode.description || "",
      thumbnail_url: episode.thumbnail_url || "",
      video_url: episode.video_url || "",
      duration: episode.duration,
      is_premium: episode.is_premium,
    });
    setShowEpisodeForm(true);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted">
            <div className="flex items-center gap-3">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div>
                <span className="font-medium">Season {season.season_number}</span>
                {season.title && <span className="text-muted-foreground ml-2">- {season.title}</span>}
                <span className="text-sm text-muted-foreground ml-4">
                  ({episodes?.length || 0} episodes)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 space-y-4 bg-background">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Episodes</h4>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  resetEpisodeForm();
                  setEpisodeForm(prev => ({ ...prev, episode_number: (episodes?.length || 0) + 1 }));
                  setShowEpisodeForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Episode
              </Button>
            </div>

            {/* Episode Form Dialog */}
            <Dialog open={showEpisodeForm} onOpenChange={setShowEpisodeForm}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingEpisode ? "Edit Episode" : "Add Episode"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEpisodeSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Episode Number</Label>
                      <Input
                        type="number"
                        value={episodeForm.episode_number}
                        onChange={e => setEpisodeForm(prev => ({ ...prev, episode_number: parseInt(e.target.value) }))}
                        min={1}
                        required
                      />
                    </div>
                    <div>
                      <Label>Duration (min)</Label>
                      <Input
                        type="number"
                        value={episodeForm.duration}
                        onChange={e => setEpisodeForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        min={0}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={episodeForm.title}
                      onChange={e => setEpisodeForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Episode title"
                      required
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={episodeForm.description}
                      onChange={e => setEpisodeForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Video URL</Label>
                    <Input
                      value={episodeForm.video_url}
                      onChange={e => setEpisodeForm(prev => ({ ...prev, video_url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Thumbnail URL</Label>
                    <Input
                      value={episodeForm.thumbnail_url}
                      onChange={e => setEpisodeForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Premium Only</Label>
                    <Switch
                      checked={episodeForm.is_premium}
                      onCheckedChange={checked => setEpisodeForm(prev => ({ ...prev, is_premium: checked }))}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetEpisodeForm}>Cancel</Button>
                    <Button type="submit" disabled={createEpisode.isPending || updateEpisode.isPending}>
                      {editingEpisode ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Episodes List */}
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading episodes...</div>
            ) : episodes?.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No episodes yet.
              </div>
            ) : (
              <div className="space-y-2">
                {episodes?.map(episode => (
                  <div 
                    key={episode.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                        <Play className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          E{episode.episode_number}: {episode.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {episode.duration} min
                          {episode.is_premium && (
                            <span className="ml-2 text-primary">Premium</span>
                          )}
                          {episode.video_url && (
                            <span className="ml-2 text-green-500">Has Video</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => startEditEpisode(episode)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteEpisode(episode.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default TVShowManagement;
