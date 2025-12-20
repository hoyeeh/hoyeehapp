import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Film, Play, Download, Loader2, Upload, Settings2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VideoUploadField } from "./VideoUploadField";
import { BatchVideoUpload } from "./BatchVideoUpload";
import { BulkEpisodeEdit } from "./BulkEpisodeEdit";
import { SortableEpisodeList } from "./SortableEpisodeList";
import { TMDBEpisodeImport } from "./TMDBEpisodeImport";
import { TMDBImportPreview, ImportOptions } from "./TMDBImportPreview";
import { 
  useSeasons, 
  useCreateSeason, 
  useUpdateSeason, 
  useDeleteSeason,
  useEpisodes,
  useCreateEpisode,
  useUpdateEpisode,
  useDeleteEpisode,
  useReorderEpisodes,
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

interface TVShowManagementProps {
  contentId: string;
  contentTitle: string;
  tmdbId?: number | null;
  onClose: () => void;
}

const TVShowManagement = ({ contentId, contentTitle, tmdbId, onClose }: TVShowManagementProps) => {
  const { toast } = useToast();
  const { data: seasons, isLoading, refetch } = useSeasons(contentId);
  const createSeason = useCreateSeason();
  const deleteSeason = useDeleteSeason();

  const [expandedSeasons, setExpandedSeasons] = useState<string[]>([]);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tmdbSeasons, setTmdbSeasons] = useState<TMDBSeason[]>([]);
  const [existingEpisodesBySeason, setExistingEpisodesBySeason] = useState<Record<string, any[]>>({});
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

  const handlePreviewTMDB = async () => {
    if (!tmdbId) {
      toast({ title: "No TMDB ID available for this show", variant: "destructive" });
      return;
    }

    setLoadingPreview(true);
    try {
      // Fetch seasons from TMDB
      const { data: seasonsData, error: seasonsError } = await supabase.functions.invoke('tmdb-seasons', {
        body: { tmdb_id: tmdbId }
      });

      if (seasonsError) throw seasonsError;

      // Fetch episodes for each season
      const seasonsWithEpisodes: TMDBSeason[] = [];
      for (const tmdbSeason of seasonsData.seasons || []) {
        const { data: episodesData } = await supabase.functions.invoke('tmdb-seasons', {
          body: { tmdb_id: tmdbId, season_number: tmdbSeason.season_number }
        });
        
        seasonsWithEpisodes.push({
          ...tmdbSeason,
          episodes: episodesData?.episodes || []
        });
      }

      setTmdbSeasons(seasonsWithEpisodes);

      // Fetch existing episodes for each season
      const episodesBySeason: Record<string, any[]> = {};
      if (seasons) {
        for (const season of seasons) {
          const { data: episodes } = await supabase
            .from('episodes')
            .select('id, episode_number, title, thumbnail_url, description')
            .eq('season_id', season.id);
          
          episodesBySeason[season.id] = episodes || [];
        }
      }
      setExistingEpisodesBySeason(episodesBySeason);

      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast({ title: "Failed to load TMDB data", description: String(error), variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmImport = async (options: ImportOptions) => {
    setImporting(true);
    try {
      const existingSeasonNumbers = new Set((seasons || []).map(s => s.season_number));
      const existingSeasonMap = new Map((seasons || []).map(s => [s.season_number, s.id]));

      let totalEpisodesAdded = 0;
      let totalEpisodesUpdated = 0;
      let seasonsImported = 0;

      for (const tmdbSeason of tmdbSeasons) {
        if (!options.selectedSeasons.includes(tmdbSeason.season_number)) continue;

        let seasonId: string;

        if (existingSeasonNumbers.has(tmdbSeason.season_number)) {
          seasonId = existingSeasonMap.get(tmdbSeason.season_number)!;
        } else {
          const seasonResult = await createSeason.mutateAsync({
            content_id: contentId,
            season_number: tmdbSeason.season_number,
            title: tmdbSeason.name,
            description: tmdbSeason.overview,
            thumbnail_url: tmdbSeason.poster_path,
            year: tmdbSeason.air_date ? parseInt(tmdbSeason.air_date.split('-')[0]) : null,
          });
          seasonId = seasonResult.id;
          seasonsImported++;
        }

        // Fetch existing episodes
        const { data: existingEpisodes } = await supabase
          .from('episodes')
          .select('id, episode_number')
          .eq('season_id', seasonId);

        const existingEpisodeMap = new Map((existingEpisodes || []).map(e => [e.episode_number, e.id]));

        for (const ep of tmdbSeason.episodes || []) {
          const existingEpisodeId = existingEpisodeMap.get(ep.episode_number);

          if (existingEpisodeId) {
            if (options.updateExisting) {
              // Update existing episode with TMDB data
              const { error: updateError } = await supabase
                .from('episodes')
                .update({
                  title: ep.title,
                  description: ep.description,
                  thumbnail_url: ep.thumbnail_url,
                  duration: ep.duration || 0,
                })
                .eq('id', existingEpisodeId);

              if (!updateError) totalEpisodesUpdated++;
            }
          } else {
            // Insert new episode
            const { error: insertError } = await supabase.from('episodes').insert({
              season_id: seasonId,
              episode_number: ep.episode_number,
              title: ep.title,
              description: ep.description,
              thumbnail_url: ep.thumbnail_url,
              duration: ep.duration || 0,
              is_premium: false,
            });

            if (!insertError) totalEpisodesAdded++;
          }
        }
      }

      refetch();
      setShowPreview(false);

      const messages = [];
      if (seasonsImported > 0) messages.push(`${seasonsImported} new seasons`);
      if (totalEpisodesAdded > 0) messages.push(`${totalEpisodesAdded} episodes added`);
      if (totalEpisodesUpdated > 0) messages.push(`${totalEpisodesUpdated} episodes updated`);

      toast({
        title: "Import Complete",
        description: messages.join(', ') || 'No changes made',
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: "Failed to import from TMDB", description: String(error), variant: "destructive" });
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
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Manage: {contentTitle}
        </CardTitle>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-semibold">Seasons ({seasons?.length || 0})</h3>
          <div className="flex gap-2 flex-wrap">
            {tmdbId && (
              <Button 
                variant="outline"
                onClick={handlePreviewTMDB}
                disabled={loadingPreview || importing}
                className="gap-2"
              >
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
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
            {tmdbId 
              ? "No seasons yet. Click 'Import from TMDB' to auto-populate seasons and episodes." 
              : "No seasons yet. Add the first season to get started."}
          </div>
        ) : (
          <div className="space-y-2">
            {seasons?.map(season => (
              <SeasonItem
                key={season.id}
                season={season}
                tmdbId={tmdbId}
                isExpanded={expandedSeasons.includes(season.id)}
                onToggle={() => toggleSeason(season.id)}
                onDelete={() => handleDeleteSeason(season.id)}
              />
            ))}
          </div>
        )}

        {/* TMDB Import Preview Dialog */}
        <TMDBImportPreview
          open={showPreview}
          onOpenChange={setShowPreview}
          tmdbSeasons={tmdbSeasons}
          existingSeasons={(seasons || []).map(s => ({ id: s.id, season_number: s.season_number }))}
          existingEpisodesBySeason={existingEpisodesBySeason}
          onConfirmImport={handleConfirmImport}
          isImporting={importing}
        />
      </CardContent>
    </Card>
  );
};

interface SeasonItemProps {
  season: Season;
  tmdbId?: number | null;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

const SeasonItem = ({ season, tmdbId, isExpanded, onToggle, onDelete }: SeasonItemProps) => {
  const { toast } = useToast();
  const { data: episodes, isLoading, refetch } = useEpisodes(season.id);
  const createEpisode = useCreateEpisode();
  const updateEpisode = useUpdateEpisode();
  const deleteEpisode = useDeleteEpisode();
  const reorderEpisodes = useReorderEpisodes();

  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [episodeForm, setEpisodeForm] = useState({
    episode_number: 1,
    title: "",
    description: "",
    thumbnail_url: "",
    video_url: "",
    duration: 0,
    is_premium: false,
    intro_start_time: 0,
    intro_end_time: 90,
    recap_start_time: null as number | null,
    recap_end_time: null as number | null,
  });

  const handleReorderEpisodes = async (updates: { id: string; episode_number: number }[]) => {
    try {
      await reorderEpisodes.mutateAsync(updates);
      toast({ title: "Episode order updated" });
    } catch (error) {
      toast({ title: "Failed to reorder episodes", variant: "destructive" });
    }
  };

  const handleEpisodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...episodeForm,
        video_url: episodeForm.video_url?.trim() || null,
      };

      if (editingEpisode) {
        await updateEpisode.mutateAsync({
          id: editingEpisode.id,
          ...payload,
        });
        toast({ title: "Episode updated" });
      } else {
        await createEpisode.mutateAsync({
          season_id: season.id,
          ...payload,
        });
        toast({ title: "Episode created" });
      }
      resetEpisodeForm();
    } catch (error) {
      console.error('Episode save error:', error);
      toast({
        title: "Error saving episode",
        description: (error as any)?.message ? String((error as any).message) : String(error),
        variant: "destructive",
      });
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
      intro_start_time: 0,
      intro_end_time: 90,
      recap_start_time: null,
      recap_end_time: null,
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
      intro_start_time: (episode as any).intro_start_time ?? 0,
      intro_end_time: (episode as any).intro_end_time ?? 90,
      recap_start_time: (episode as any).recap_start_time ?? null,
      recap_end_time: (episode as any).recap_end_time ?? null,
    });
    setShowEpisodeForm(true);
  };

  const missingVideoCount = (episodes || []).filter((ep) => !ep.video_url).length;

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
                  ({episodes?.length || 0} episodes{missingVideoCount > 0 ? ` • ${missingVideoCount} missing video` : ""})
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
            {showBulkEdit && episodes ? (
              <BulkEpisodeEdit
                episodes={episodes.map(ep => ({
                  id: ep.id,
                  episode_number: ep.episode_number,
                  title: ep.title,
                  duration: ep.duration,
                  is_premium: ep.is_premium,
                }))}
                onComplete={() => refetch()}
                onClose={() => setShowBulkEdit(false)}
              />
            ) : showBatchUpload && episodes ? (
              <BatchVideoUpload
                seasonId={season.id}
                seasonNumber={season.season_number}
                episodes={episodes.map(ep => ({
                  id: ep.id,
                  episode_number: ep.episode_number,
                  title: ep.title,
                  video_url: ep.video_url,
                }))}
                onComplete={() => {
                  refetch();
                  setShowBatchUpload(false);
                }}
                onClose={() => setShowBatchUpload(false)}
              />
            ) : (
              <>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="text-sm font-medium">Episodes</h4>
              <div className="flex gap-2 flex-wrap">
                {episodes && episodes.length > 0 && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowBulkEdit(true)}
                      className="gap-2"
                    >
                      <Settings2 className="h-4 w-4" />
                      Bulk Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowBatchUpload(true)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Batch Upload
                    </Button>
                  </>
                )}
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
            </div>

            {/* Episode Form Dialog */}
            <Dialog open={showEpisodeForm} onOpenChange={setShowEpisodeForm}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEpisode ? "Edit Episode" : "Add Episode"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEpisodeSubmit} className="space-y-4">
                  {/* TMDB Episode Import */}
                  {tmdbId && !editingEpisode && (
                    <TMDBEpisodeImport
                      tmdbId={tmdbId}
                      seasonNumber={season.season_number}
                      onSelectEpisode={(ep) => setEpisodeForm(prev => ({
                        ...prev,
                        episode_number: ep.episode_number,
                        title: ep.title,
                        description: ep.description,
                        thumbnail_url: ep.thumbnail_url,
                        duration: ep.duration,
                      }))}
                    />
                  )}
                  
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
                  
                  {/* Video Upload Field */}
                  <VideoUploadField
                    value={episodeForm.video_url}
                    onChange={(url) => setEpisodeForm(prev => ({ ...prev, video_url: url }))}
                    onDurationDetected={(duration) => setEpisodeForm(prev => ({ ...prev, duration: Math.floor(duration / 60) }))}
                    label="Episode Video"
                    folder={`episodes/s${season.season_number}`}
                  />

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

                  {/* Intro Skip Times */}
                  <div className="border-t border-border pt-4 mt-4">
                    <Label className="text-sm font-medium mb-2 block">Skip Intro Settings (seconds)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Intro Start</Label>
                        <Input
                          type="number"
                          value={episodeForm.intro_start_time}
                          onChange={e => setEpisodeForm(prev => ({ ...prev, intro_start_time: parseInt(e.target.value) || 0 }))}
                          min={0}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Intro End</Label>
                        <Input
                          type="number"
                          value={episodeForm.intro_end_time}
                          onChange={e => setEpisodeForm(prev => ({ ...prev, intro_end_time: parseInt(e.target.value) || 90 }))}
                          min={0}
                          placeholder="90"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recap Settings */}
                  <div className="border-t border-border pt-4">
                    <Label className="text-sm font-medium mb-2 block">"Previously On" Recap (seconds)</Label>
                    <p className="text-xs text-muted-foreground mb-2">Set the time range for the recap segment from the previous episode. Leave empty if no recap.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Recap Start</Label>
                        <Input
                          type="number"
                          value={episodeForm.recap_start_time ?? ""}
                          onChange={e => setEpisodeForm(prev => ({ 
                            ...prev, 
                            recap_start_time: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                          min={0}
                          placeholder="Empty = no recap"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Recap End</Label>
                        <Input
                          type="number"
                          value={episodeForm.recap_end_time ?? ""}
                          onChange={e => setEpisodeForm(prev => ({ 
                            ...prev, 
                            recap_end_time: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                          min={0}
                          placeholder="Empty = no recap"
                        />
                      </div>
                    </div>
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

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading episodes...</div>
            ) : episodes?.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No episodes yet. Add episodes or import from TMDB.
              </div>
            ) : (
              <SortableEpisodeList
                episodes={episodes.map(ep => ({
                  id: ep.id,
                  episode_number: ep.episode_number,
                  title: ep.title,
                  duration: ep.duration,
                  is_premium: ep.is_premium,
                  video_url: ep.video_url,
                  description: ep.description,
                  thumbnail_url: ep.thumbnail_url,
                  intro_start_time: ep.intro_start_time,
                  intro_end_time: ep.intro_end_time,
                  recap_start_time: ep.recap_start_time,
                  recap_end_time: ep.recap_end_time,
                }))}
                onEdit={startEditEpisode}
                onDelete={handleDeleteEpisode}
                onReorder={handleReorderEpisodes}
              />
            )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default TVShowManagement;
