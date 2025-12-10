import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertCircle, Database, Image, Video } from "lucide-react";
import { toCdnUrl } from "@/utils/cdnUrl";

interface MigrationStats {
  contentVideos: { total: number; migrated: number };
  contentThumbnails: { total: number; migrated: number };
  episodeVideos: { total: number; migrated: number };
  episodeThumbnails: { total: number; migrated: number };
  heroBanners: { total: number; migrated: number };
  comingSoon: { total: number; migrated: number };
}

export const CDNMigrationTool = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [progress, setProgress] = useState(0);

  const isOriginUrl = (url: string | null): boolean => {
    if (!url) return false;
    return url.includes('.digitaloceanspaces.com') && !url.includes('.cdn.digitaloceanspaces.com');
  };

  const scanDatabase = async () => {
    setIsScanning(true);
    try {
      // Fetch all content
      const { data: content } = await supabase.from('content').select('id, video_url, thumbnail_url');
      const { data: episodes } = await supabase.from('episodes').select('id, video_url, thumbnail_url');
      const { data: heroBanners } = await supabase.from('hero_banners').select('id, image_url, video_url');
      const { data: comingSoon } = await supabase.from('coming_soon').select('id, thumbnail_url, trailer_url');

      const newStats: MigrationStats = {
        contentVideos: {
          total: content?.filter(c => c.video_url?.includes('digitaloceanspaces.com')).length || 0,
          migrated: content?.filter(c => isOriginUrl(c.video_url)).length || 0,
        },
        contentThumbnails: {
          total: content?.filter(c => c.thumbnail_url?.includes('digitaloceanspaces.com')).length || 0,
          migrated: content?.filter(c => isOriginUrl(c.thumbnail_url)).length || 0,
        },
        episodeVideos: {
          total: episodes?.filter(e => e.video_url?.includes('digitaloceanspaces.com')).length || 0,
          migrated: episodes?.filter(e => isOriginUrl(e.video_url)).length || 0,
        },
        episodeThumbnails: {
          total: episodes?.filter(e => e.thumbnail_url?.includes('digitaloceanspaces.com')).length || 0,
          migrated: episodes?.filter(e => isOriginUrl(e.thumbnail_url)).length || 0,
        },
        heroBanners: {
          total: (heroBanners?.filter(h => h.image_url?.includes('digitaloceanspaces.com')).length || 0) +
                 (heroBanners?.filter(h => h.video_url?.includes('digitaloceanspaces.com')).length || 0),
          migrated: (heroBanners?.filter(h => isOriginUrl(h.image_url)).length || 0) +
                    (heroBanners?.filter(h => isOriginUrl(h.video_url)).length || 0),
        },
        comingSoon: {
          total: (comingSoon?.filter(c => c.thumbnail_url?.includes('digitaloceanspaces.com')).length || 0) +
                 (comingSoon?.filter(c => c.trailer_url?.includes('digitaloceanspaces.com')).length || 0),
          migrated: (comingSoon?.filter(c => isOriginUrl(c.thumbnail_url)).length || 0) +
                    (comingSoon?.filter(c => isOriginUrl(c.trailer_url)).length || 0),
        },
      };

      setStats(newStats);
      toast.success('Scan complete');
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan database');
    } finally {
      setIsScanning(false);
    }
  };

  const migrateUrls = async () => {
    if (!stats) return;
    
    setIsMigrating(true);
    setProgress(0);
    
    const totalToMigrate = 
      stats.contentVideos.migrated + 
      stats.contentThumbnails.migrated + 
      stats.episodeVideos.migrated + 
      stats.episodeThumbnails.migrated +
      stats.heroBanners.migrated +
      stats.comingSoon.migrated;

    if (totalToMigrate === 0) {
      toast.info('No URLs need migration');
      setIsMigrating(false);
      return;
    }

    let migrated = 0;

    try {
      // Migrate content videos and thumbnails
      const { data: content } = await supabase.from('content').select('id, video_url, thumbnail_url');
      for (const item of content || []) {
        const updates: Record<string, string> = {};
        if (isOriginUrl(item.video_url)) updates.video_url = toCdnUrl(item.video_url!);
        if (isOriginUrl(item.thumbnail_url)) updates.thumbnail_url = toCdnUrl(item.thumbnail_url!);
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('content').update(updates).eq('id', item.id);
          migrated += Object.keys(updates).length;
          setProgress((migrated / totalToMigrate) * 100);
        }
      }

      // Migrate episode videos and thumbnails
      const { data: episodes } = await supabase.from('episodes').select('id, video_url, thumbnail_url');
      for (const item of episodes || []) {
        const updates: Record<string, string> = {};
        if (isOriginUrl(item.video_url)) updates.video_url = toCdnUrl(item.video_url!);
        if (isOriginUrl(item.thumbnail_url)) updates.thumbnail_url = toCdnUrl(item.thumbnail_url!);
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('episodes').update(updates).eq('id', item.id);
          migrated += Object.keys(updates).length;
          setProgress((migrated / totalToMigrate) * 100);
        }
      }

      // Migrate hero banners
      const { data: heroBanners } = await supabase.from('hero_banners').select('id, image_url, video_url');
      for (const item of heroBanners || []) {
        const updates: Record<string, string> = {};
        if (isOriginUrl(item.image_url)) updates.image_url = toCdnUrl(item.image_url!);
        if (isOriginUrl(item.video_url)) updates.video_url = toCdnUrl(item.video_url!);
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('hero_banners').update(updates).eq('id', item.id);
          migrated += Object.keys(updates).length;
          setProgress((migrated / totalToMigrate) * 100);
        }
      }

      // Migrate coming soon
      const { data: comingSoon } = await supabase.from('coming_soon').select('id, thumbnail_url, trailer_url');
      for (const item of comingSoon || []) {
        const updates: Record<string, string> = {};
        if (isOriginUrl(item.thumbnail_url)) updates.thumbnail_url = toCdnUrl(item.thumbnail_url!);
        if (isOriginUrl(item.trailer_url)) updates.trailer_url = toCdnUrl(item.trailer_url!);
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('coming_soon').update(updates).eq('id', item.id);
          migrated += Object.keys(updates).length;
          setProgress((migrated / totalToMigrate) * 100);
        }
      }

      toast.success(`Successfully migrated ${migrated} URLs to CDN format`);
      await scanDatabase(); // Refresh stats
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    } finally {
      setIsMigrating(false);
      setProgress(100);
    }
  };

  const needsMigration = stats && (
    stats.contentVideos.migrated > 0 ||
    stats.contentThumbnails.migrated > 0 ||
    stats.episodeVideos.migrated > 0 ||
    stats.episodeThumbnails.migrated > 0 ||
    stats.heroBanners.migrated > 0 ||
    stats.comingSoon.migrated > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          CDN URL Migration Tool
        </CardTitle>
        <CardDescription>
          Convert existing DigitalOcean Spaces origin URLs to CDN format for faster content delivery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Button onClick={scanDatabase} disabled={isScanning || isMigrating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Database'}
          </Button>
          
          {stats && needsMigration && (
            <Button onClick={migrateUrls} disabled={isMigrating} variant="default">
              {isMigrating ? 'Migrating...' : 'Migrate to CDN'}
            </Button>
          )}
        </div>

        {isMigrating && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>
        )}

        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={<Video className="h-4 w-4" />}
              title="Content Videos"
              total={stats.contentVideos.total}
              needsMigration={stats.contentVideos.migrated}
            />
            <StatCard
              icon={<Image className="h-4 w-4" />}
              title="Content Thumbnails"
              total={stats.contentThumbnails.total}
              needsMigration={stats.contentThumbnails.migrated}
            />
            <StatCard
              icon={<Video className="h-4 w-4" />}
              title="Episode Videos"
              total={stats.episodeVideos.total}
              needsMigration={stats.episodeVideos.migrated}
            />
            <StatCard
              icon={<Image className="h-4 w-4" />}
              title="Episode Thumbnails"
              total={stats.episodeThumbnails.total}
              needsMigration={stats.episodeThumbnails.migrated}
            />
            <StatCard
              icon={<Image className="h-4 w-4" />}
              title="Hero Banners"
              total={stats.heroBanners.total}
              needsMigration={stats.heroBanners.migrated}
            />
            <StatCard
              icon={<Video className="h-4 w-4" />}
              title="Coming Soon"
              total={stats.comingSoon.total}
              needsMigration={stats.comingSoon.migrated}
            />
          </div>
        )}

        {stats && !needsMigration && (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            <span>All URLs are already using CDN format</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StatCard = ({ 
  icon, 
  title, 
  total, 
  needsMigration 
}: { 
  icon: React.ReactNode; 
  title: string; 
  total: number; 
  needsMigration: number;
}) => (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-2xl font-bold">{total}</span>
      {needsMigration > 0 ? (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {needsMigration} to migrate
        </Badge>
      ) : (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          All CDN
        </Badge>
      )}
    </div>
  </div>
);
