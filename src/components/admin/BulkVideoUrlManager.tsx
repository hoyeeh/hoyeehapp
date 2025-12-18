import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateVideoUrl } from "@/utils/videoUrlValidation";
import { 
  Video, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Upload, 
  Link2, 
  RefreshCw,
  Download,
  FileText
} from "lucide-react";

interface EpisodeWithMissingUrl {
  id: string;
  title: string;
  episode_number: number;
  season_id: string;
  season_number: number;
  content_title: string;
  content_id: string;
  video_url: string | null;
  newUrl?: string;
  status?: 'pending' | 'validating' | 'valid' | 'invalid' | 'saving' | 'saved' | 'error';
  error?: string;
}

export const BulkVideoUrlManager = () => {
  const { toast } = useToast();
  const [episodes, setEpisodes] = useState<EpisodeWithMissingUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUrl, setBulkUrl] = useState("");
  const [csvData, setCsvData] = useState("");
  const [progress, setProgress] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      // Fetch episodes with their season and content info
      const { data, error } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          episode_number,
          season_id,
          video_url,
          seasons!inner(
            season_number,
            content_id,
            content!inner(title)
          )
        `)
        .order('episode_number');

      if (error) throw error;

      const formatted: EpisodeWithMissingUrl[] = (data || [])
        .filter((ep: any) => showAll || !ep.video_url)
        .map((ep: any) => ({
          id: ep.id,
          title: ep.title,
          episode_number: ep.episode_number,
          season_id: ep.season_id,
          season_number: ep.seasons.season_number,
          content_title: ep.seasons.content.title,
          content_id: ep.seasons.content_id,
          video_url: ep.video_url,
          status: 'pending' as const,
        }));

      setEpisodes(formatted);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Fetch error:', error);
      toast({ title: "Failed to load episodes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [showAll]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === episodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(episodes.map(ep => ep.id)));
    }
  };

  const updateEpisodeUrl = (id: string, url: string) => {
    setEpisodes(prev => prev.map(ep => 
      ep.id === id ? { ...ep, newUrl: url, status: 'pending' } : ep
    ));
  };

  const applyBulkPattern = () => {
    if (!bulkUrl.includes('{episode}') && !bulkUrl.includes('{season}')) {
      toast({ 
        title: "Pattern must include {episode} or {season} placeholder", 
        variant: "destructive" 
      });
      return;
    }

    setEpisodes(prev => prev.map(ep => {
      if (!selectedIds.has(ep.id)) return ep;
      
      const url = bulkUrl
        .replace('{episode}', String(ep.episode_number).padStart(2, '0'))
        .replace('{season}', String(ep.season_number).padStart(2, '0'))
        .replace('{title}', ep.title.toLowerCase().replace(/\s+/g, '-'));
      
      return { ...ep, newUrl: url, status: 'pending' };
    }));

    toast({ title: `Applied pattern to ${selectedIds.size} episodes` });
  };

  const parseCsv = () => {
    const lines = csvData.trim().split('\n');
    let matched = 0;

    for (const line of lines) {
      const [identifier, url] = line.split(',').map(s => s.trim());
      if (!identifier || !url) continue;

      // Try to match by episode ID or by "S01E01" format
      setEpisodes(prev => prev.map(ep => {
        if (ep.id === identifier) {
          matched++;
          return { ...ep, newUrl: url, status: 'pending' };
        }
        
        // Match S01E02 format
        const match = identifier.match(/S(\d+)E(\d+)/i);
        if (match) {
          const [, season, episode] = match;
          if (ep.season_number === parseInt(season) && ep.episode_number === parseInt(episode)) {
            matched++;
            return { ...ep, newUrl: url, status: 'pending' };
          }
        }
        
        return ep;
      }));
    }

    toast({ title: `Matched ${matched} episodes from CSV` });
  };

  const validateSelected = async () => {
    const toValidate = episodes.filter(ep => selectedIds.has(ep.id) && ep.newUrl);
    
    for (let i = 0; i < toValidate.length; i++) {
      const ep = toValidate[i];
      setEpisodes(prev => prev.map(e => 
        e.id === ep.id ? { ...e, status: 'validating' } : e
      ));

      const result = await validateVideoUrl(ep.newUrl!);
      
      setEpisodes(prev => prev.map(e => 
        e.id === ep.id 
          ? { ...e, status: result.valid ? 'valid' : 'invalid', error: result.error }
          : e
      ));

      setProgress(((i + 1) / toValidate.length) * 100);
    }

    setProgress(0);
  };

  const saveSelected = async () => {
    const toSave = episodes.filter(ep => 
      selectedIds.has(ep.id) && 
      ep.newUrl && 
      (ep.status === 'valid' || ep.status === 'pending')
    );

    if (toSave.length === 0) {
      toast({ title: "No valid URLs to save", variant: "destructive" });
      return;
    }

    setSaving(true);
    let saved = 0;
    let failed = 0;

    for (let i = 0; i < toSave.length; i++) {
      const ep = toSave[i];
      setEpisodes(prev => prev.map(e => 
        e.id === ep.id ? { ...e, status: 'saving' } : e
      ));

      const { error } = await supabase
        .from('episodes')
        .update({ video_url: ep.newUrl!.trim() })
        .eq('id', ep.id);

      if (error) {
        failed++;
        setEpisodes(prev => prev.map(e => 
          e.id === ep.id ? { ...e, status: 'error', error: error.message } : e
        ));
      } else {
        saved++;
        setEpisodes(prev => prev.map(e => 
          e.id === ep.id ? { ...e, status: 'saved', video_url: ep.newUrl } : e
        ));
      }

      setProgress(((i + 1) / toSave.length) * 100);
    }

    setSaving(false);
    setProgress(0);
    toast({ 
      title: "Save Complete", 
      description: `${saved} saved, ${failed} failed` 
    });
  };

  const exportTemplate = () => {
    const csv = episodes
      .filter(ep => !ep.video_url)
      .map(ep => `S${String(ep.season_number).padStart(2,'0')}E${String(ep.episode_number).padStart(2,'0')},`)
      .join('\n');
    
    const blob = new Blob([`# Format: S01E01,https://video-url.com/video.mp4\n${csv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'missing-video-urls.csv';
    a.click();
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'validating':
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Validating</Badge>;
      case 'valid':
        return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="h-3 w-3" />Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Invalid</Badge>;
      case 'saving':
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving</Badge>;
      case 'saved':
        return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="h-3 w-3" />Saved</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const missingCount = episodes.filter(ep => !ep.video_url).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Bulk Video URL Manager
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {missingCount} episodes missing video URLs
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV Template
          </Button>
          <Button variant="outline" size="sm" onClick={fetchEpisodes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showAll}
              onCheckedChange={(checked) => setShowAll(!!checked)}
            />
            Show all episodes (including those with URLs)
          </label>
        </div>

        {/* Bulk Actions */}
        <Tabs defaultValue="pattern" className="w-full">
          <TabsList>
            <TabsTrigger value="pattern" className="gap-2">
              <Link2 className="h-4 w-4" />
              URL Pattern
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-2">
              <FileText className="h-4 w-4" />
              CSV Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pattern" className="space-y-4">
            <div>
              <Label>URL Pattern</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Use {'{season}'}, {'{episode}'}, {'{title}'} as placeholders
              </p>
              <div className="flex gap-2">
                <Input
                  value={bulkUrl}
                  onChange={(e) => setBulkUrl(e.target.value)}
                  placeholder="https://cdn.example.com/s{season}/e{episode}.mp4"
                  className="flex-1"
                />
                <Button onClick={applyBulkPattern} disabled={selectedIds.size === 0}>
                  Apply to Selected
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-4">
            <div>
              <Label>CSV Data (episode_id or S01E01 format, video_url)</Label>
              <Textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="S01E01,https://cdn.example.com/video1.mp4&#10;S01E02,https://cdn.example.com/video2.mp4"
                rows={6}
                className="font-mono text-sm"
              />
              <Button onClick={parseCsv} className="mt-2">
                Parse CSV
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Progress */}
        {progress > 0 && (
          <Progress value={progress} className="h-2" />
        )}

        {/* Episode List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Episodes ({episodes.length})</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedIds.size === episodes.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={validateSelected}
                disabled={selectedIds.size === 0}
              >
                Validate Selected
              </Button>
              <Button 
                size="sm" 
                onClick={saveSelected}
                disabled={saving || selectedIds.size === 0}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Save Selected</>
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading episodes...
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showAll ? "No episodes found" : "All episodes have video URLs!"}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
              {episodes.map(ep => (
                <div key={ep.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                  <Checkbox
                    checked={selectedIds.has(ep.id)}
                    onCheckedChange={() => toggleSelect(ep.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{ep.content_title}</span>
                      <Badge variant="outline" className="text-xs">
                        S{ep.season_number}E{ep.episode_number}
                      </Badge>
                      {ep.video_url && !ep.newUrl && (
                        <Badge variant="secondary" className="text-xs">Has URL</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ep.title}</p>
                    <Input
                      value={ep.newUrl || ''}
                      onChange={(e) => updateEpisodeUrl(ep.id, e.target.value)}
                      placeholder={ep.video_url || "Enter video URL..."}
                      className="mt-2 h-8 text-xs"
                    />
                    {ep.error && (
                      <p className="text-xs text-destructive mt-1">{ep.error}</p>
                    )}
                  </div>
                  {getStatusBadge(ep.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
