import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, HardDrive, Film, Video, TrendingUp, DollarSign } from "lucide-react";

interface StorageStats {
  totalVideos: number;
  totalEpisodes: number;
  transcodedCount: number;
  pendingCount: number;
  estimatedStorageGB: number;
  estimatedBandwidthGB: number;
  estimatedMonthlyCost: number;
}

// Estimate costs based on typical video streaming pricing
const STORAGE_COST_PER_GB = 0.023; // $/GB/month (approximate DO Spaces pricing)
const BANDWIDTH_COST_PER_GB = 0.01; // $/GB (approximate egress pricing)
const MUX_ENCODING_COST_PER_MIN = 0.015; // $/minute of video encoded
const MUX_DELIVERY_COST_PER_VIEW = 0.00025; // $/view (approximate)

export const StorageAnalytics = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['storage-analytics'],
    queryFn: async () => {
      // Get content count
      const { count: contentCount } = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true });

      // Get episodes with video URLs
      const { data: episodes } = await supabase
        .from('episodes')
        .select('id, video_url, duration')
        .not('video_url', 'is', null);

      // Get transcoding jobs
      const { data: jobs } = await supabase
        .from('transcoding_jobs')
        .select('status, episode_id');

      const completedJobs = jobs?.filter(j => j.status === 'completed') || [];
      const pendingJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'processing') || [];

      // Estimate storage based on typical video sizes
      // Assume average video is 500MB source + 300MB HLS (multiple renditions)
      const sourceStorageGB = (episodes?.length || 0) * 0.5; // 500MB per source
      const hlsStorageGB = completedJobs.length * 0.3; // 300MB per transcoded video
      const totalStorageGB = sourceStorageGB + hlsStorageGB;

      // Estimate bandwidth based on views (rough estimate)
      // Assume each content has average 100 views, 30min average watch time at 720p (1.5GB/hr = 0.75GB/30min)
      const { data: viewData } = await supabase
        .from('content')
        .select('view_count');

      const totalViews = viewData?.reduce((sum, c) => sum + (c.view_count || 0), 0) || 0;
      const estimatedBandwidthGB = totalViews * 0.5; // ~500MB per view average

      // Calculate total duration for encoding cost
      const totalDurationMinutes = episodes?.reduce((sum, ep) => sum + ((ep.duration || 0) / 60), 0) || 0;

      // Calculate costs
      const storageCost = totalStorageGB * STORAGE_COST_PER_GB;
      const bandwidthCost = estimatedBandwidthGB * BANDWIDTH_COST_PER_GB;
      const encodingCost = totalDurationMinutes * MUX_ENCODING_COST_PER_MIN;
      const deliveryCost = totalViews * MUX_DELIVERY_COST_PER_VIEW;

      const estimatedMonthlyCost = storageCost + bandwidthCost + encodingCost + deliveryCost;

      return {
        totalVideos: contentCount || 0,
        totalEpisodes: episodes?.length || 0,
        transcodedCount: completedJobs.length,
        pendingCount: pendingJobs.length,
        estimatedStorageGB: totalStorageGB,
        estimatedBandwidthGB,
        estimatedMonthlyCost,
        totalViews,
        totalDurationMinutes,
        storageCost,
        bandwidthCost,
        encodingCost,
        deliveryCost,
      } as StorageStats & { 
        totalViews: number; 
        totalDurationMinutes: number;
        storageCost: number;
        bandwidthCost: number;
        encodingCost: number;
        deliveryCost: number;
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const transcodingProgress = stats?.totalEpisodes 
    ? (stats.transcodedCount / stats.totalEpisodes) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Film className="h-4 w-4" />
              Total Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.totalVideos || 0}</span>
            <p className="text-xs text-muted-foreground">Movies & TV Shows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Video className="h-4 w-4" />
              Total Episodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.totalEpisodes || 0}</span>
            <p className="text-xs text-muted-foreground">With video files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Est. Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.estimatedStorageGB?.toFixed(1) || 0} GB</span>
            <p className="text-xs text-muted-foreground">Source + HLS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.totalViews?.toLocaleString() || 0}</span>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Transcoding Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">HLS Transcoding Progress</CardTitle>
          <CardDescription>
            {stats?.transcodedCount || 0} of {stats?.totalEpisodes || 0} episodes transcoded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{transcodingProgress.toFixed(1)}%</span>
            </div>
            <Progress value={transcodingProgress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <span>Pending: {stats?.pendingCount || 0}</span>
              <span>Remaining: {(stats?.totalEpisodes || 0) - (stats?.transcodedCount || 0) - (stats?.pendingCount || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Estimated Monthly Costs
          </CardTitle>
          <CardDescription>
            Based on current usage patterns and standard cloud pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Storage</p>
                <p className="text-lg font-bold">${stats?.storageCost?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-muted-foreground">{stats?.estimatedStorageGB?.toFixed(1)} GB</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Bandwidth</p>
                <p className="text-lg font-bold">${stats?.bandwidthCost?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-muted-foreground">{stats?.estimatedBandwidthGB?.toFixed(1)} GB</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Encoding</p>
                <p className="text-lg font-bold">${stats?.encodingCost?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-muted-foreground">{stats?.totalDurationMinutes?.toFixed(0)} min</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Delivery</p>
                <p className="text-lg font-bold">${stats?.deliveryCost?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-muted-foreground">{stats?.totalViews} views</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="font-medium">Estimated Total Monthly Cost</span>
                <span className="text-2xl font-bold text-primary">
                  ${stats?.estimatedMonthlyCost?.toFixed(2) || '0.00'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                *Estimates based on DO Spaces and Mux standard pricing. Actual costs may vary.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};