import { useHomepageAdStats, HomepageAd } from '@/hooks/useHomepageAds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Eye, MousePointer, Play, AlertTriangle } from 'lucide-react';

interface HomepageAdStatsProps {
  ad: HomepageAd;
  onBack: () => void;
}

export function HomepageAdStats({ ad, onBack }: HomepageAdStatsProps) {
  const { data: stats, isLoading } = useHomepageAdStats(ad.id);

  const ctr = stats && stats.impressions > 0 
    ? ((stats.clicks / stats.impressions) * 100).toFixed(2) 
    : '0.00';

  const playRate = stats && stats.impressions > 0
    ? ((stats.plays / stats.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Ad Analytics</h2>
          <p className="text-muted-foreground">{ad.title}</p>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <img
              src={ad.poster_url}
              alt={ad.title}
              className="w-48 h-28 object-cover rounded-lg"
            />
            <div>
              <h3 className="font-semibold text-lg">{ad.title}</h3>
              {ad.subtitle && (
                <p className="text-muted-foreground">{ad.subtitle}</p>
              )}
              {ad.cta_label && (
                <p className="text-sm text-primary mt-2">CTA: {ad.cta_label}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : stats?.impressions.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : stats?.clicks.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">CTR: {ctr}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Video Plays</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : stats?.plays.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Play rate: {playRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '...' : stats?.errors.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{ad.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Priority</p>
              <p className="font-medium">{ad.priority}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Weight</p>
              <p className="font-medium">{ad.weight}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Kids Safe</p>
              <p className="font-medium">{ad.kids_safe ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contexts</p>
              <p className="font-medium">
                {[
                  ad.contexts?.main && 'Main',
                  ad.contexts?.kids && 'Kids',
                  ad.contexts?.tv && 'TV',
                ].filter(Boolean).join(', ') || 'None'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Video Type</p>
              <p className="font-medium uppercase">{ad.video_type || 'None'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
