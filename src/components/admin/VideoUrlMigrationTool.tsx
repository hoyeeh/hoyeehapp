import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Loader2,
  ArrowRight,
  Film,
  Tv,
  Database
} from "lucide-react";
import { migrateVideoUrlToCdn, needsCdnMigration } from "@/utils/videoUrlValidation";

interface MigrationItem {
  id: string;
  type: 'content' | 'episode';
  title: string;
  oldUrl: string;
  newUrl: string;
  selected: boolean;
  status: 'pending' | 'migrating' | 'success' | 'error';
  error?: string;
}

export const VideoUrlMigrationTool = () => {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);

  const scanForMigrations = async () => {
    setScanning(true);
    setItems([]);
    
    try {
      // Scan content table
      const { data: contentData, error: contentError } = await supabase
        .from('content')
        .select('id, title, video_url')
        .not('video_url', 'is', null);

      if (contentError) throw contentError;

      // Scan episodes table
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('id, title, video_url')
        .not('video_url', 'is', null);

      if (episodesError) throw episodesError;

      const migrationItems: MigrationItem[] = [];

      // Process content
      for (const content of contentData || []) {
        if (content.video_url && needsCdnMigration(content.video_url)) {
          migrationItems.push({
            id: content.id,
            type: 'content',
            title: content.title,
            oldUrl: content.video_url,
            newUrl: migrateVideoUrlToCdn(content.video_url),
            selected: true,
            status: 'pending',
          });
        }
      }

      // Process episodes
      for (const episode of episodesData || []) {
        if (episode.video_url && needsCdnMigration(episode.video_url)) {
          migrationItems.push({
            id: episode.id,
            type: 'episode',
            title: episode.title,
            oldUrl: episode.video_url,
            newUrl: migrateVideoUrlToCdn(episode.video_url),
            selected: true,
            status: 'pending',
          });
        }
      }

      setItems(migrationItems);

      if (migrationItems.length === 0) {
        toast.success("All video URLs are already using CDN format!");
      } else {
        toast.info(`Found ${migrationItems.length} URLs that need migration`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error("Failed to scan for migrations");
    } finally {
      setScanning(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleAll = (selected: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const runMigration = async () => {
    const selectedItems = items.filter(item => item.selected && item.status === 'pending');
    if (selectedItems.length === 0) {
      toast.error("No items selected for migration");
      return;
    }

    setMigrating(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      
      // Update status to migrating
      setItems(prev => prev.map(it => 
        it.id === item.id ? { ...it, status: 'migrating' } : it
      ));

      try {
        if (item.type === 'content') {
          const { error } = await supabase
            .from('content')
            .update({ video_url: item.newUrl })
            .eq('id', item.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('episodes')
            .update({ video_url: item.newUrl })
            .eq('id', item.id);

          if (error) throw error;
        }

        setItems(prev => prev.map(it => 
          it.id === item.id ? { ...it, status: 'success' } : it
        ));
        successCount++;
      } catch (error) {
        console.error(`Migration error for ${item.id}:`, error);
        setItems(prev => prev.map(it => 
          it.id === item.id ? { ...it, status: 'error', error: 'Failed to update' } : it
        ));
        errorCount++;
      }

      setProgress(Math.round(((i + 1) / selectedItems.length) * 100));
    }

    setMigrating(false);
    
    if (errorCount === 0) {
      toast.success(`Successfully migrated ${successCount} URLs to CDN format`);
    } else {
      toast.warning(`Migrated ${successCount} URLs, ${errorCount} failed`);
    }
  };

  const selectedCount = items.filter(i => i.selected && i.status === 'pending').length;
  const contentCount = items.filter(i => i.type === 'content').length;
  const episodeCount = items.filter(i => i.type === 'episode').length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Video URL Migration Tool
        </CardTitle>
        <CardDescription>
          Scan and migrate video URLs from origin format to CDN format for better performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={scanForMigrations} 
            disabled={scanning || migrating}
            variant="outline"
            className="gap-2"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Scan for URLs
          </Button>

          {items.length > 0 && (
            <Button 
              onClick={runMigration}
              disabled={migrating || selectedCount === 0}
              className="gap-2"
            >
              {migrating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Migrate Selected ({selectedCount})
            </Button>
          )}
        </div>

        {/* Stats */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-blue-500" />
              <span>{contentCount} Movies</span>
            </div>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-purple-500" />
              <span>{episodeCount} Episodes</span>
            </div>
          </div>
        )}

        {/* Progress */}
        {migrating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Migration Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">URLs to Migrate</span>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleAll(true)}
                  disabled={migrating}
                >
                  Select All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleAll(false)}
                  disabled={migrating}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] border border-border rounded-lg">
              <div className="p-3 space-y-2">
                {items.map((item) => (
                  <div 
                    key={item.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      item.status === 'success' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : item.status === 'error'
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(item.id)}
                        disabled={migrating || item.status !== 'pending'}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {item.type === 'content' ? (
                            <Film className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Tv className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          )}
                          <span className="font-medium truncate">{item.title}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {item.type}
                          </Badge>
                        </div>
                        
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-10">Old:</span>
                            <code className="bg-secondary px-1.5 py-0.5 rounded text-destructive truncate max-w-full block">
                              {item.oldUrl}
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-10">New:</span>
                            <code className="bg-secondary px-1.5 py-0.5 rounded text-green-500 truncate max-w-full block">
                              {item.newUrl}
                            </code>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {item.status === 'migrating' && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {item.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {item.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {!scanning && items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Scan for URLs" to find video URLs that need migration</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
