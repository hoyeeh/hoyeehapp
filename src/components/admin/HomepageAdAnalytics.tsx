import { useState } from 'react';
import { 
  useHomepageAdStats, 
  useHomepageAdAnalytics, 
  useABTestResults,
  useABTests,
  HomepageAd 
} from '@/hooks/useHomepageAds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Eye, 
  MousePointer, 
  Play, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Beaker,
  Calendar,
  Users,
  Crown,
  BarChart3
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface HomepageAdAnalyticsProps {
  ad: HomepageAd;
  onBack: () => void;
}

export function HomepageAdAnalytics({ ad, onBack }: HomepageAdAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30');
  const { data: stats, isLoading: statsLoading } = useHomepageAdStats(ad.id);
  const { data: analytics, isLoading: analyticsLoading } = useHomepageAdAnalytics(ad.id, parseInt(timeRange));
  const { data: abTestResults } = useABTestResults(ad.ab_test_id);
  const { data: allAbTests } = useABTests();

  const ctr = stats && stats.impressions > 0 
    ? ((stats.clicks / stats.impressions) * 100).toFixed(2) 
    : '0.00';

  const playRate = stats && stats.impressions > 0
    ? ((stats.plays / stats.impressions) * 100).toFixed(2)
    : '0.00';

  // Calculate trend (compare last 7 days vs previous 7 days)
  const calculateTrend = () => {
    if (!analytics || analytics.length < 14) return null;
    
    const recent = analytics.slice(-7);
    const previous = analytics.slice(-14, -7);
    
    const recentClicks = recent.reduce((sum, d) => sum + d.clicks, 0);
    const previousClicks = previous.reduce((sum, d) => sum + d.clicks, 0);
    
    if (previousClicks === 0) return null;
    const change = ((recentClicks - previousClicks) / previousClicks) * 100;
    return change.toFixed(1);
  };

  const trend = calculateTrend();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Ad Analytics</h2>
            <p className="text-muted-foreground">{ad.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ad.subscription_target !== 'all' && (
            <Badge variant={ad.subscription_target === 'premium' ? 'default' : 'secondary'}>
              {ad.subscription_target === 'premium' ? <Crown className="w-3 h-3 mr-1" /> : <Users className="w-3 h-3 mr-1" />}
              {ad.subscription_target === 'premium' ? 'Premium' : 'Free'} Users
            </Badge>
          )}
          {ad.ab_test_id && (
            <Badge variant="outline">
              <Beaker className="w-3 h-3 mr-1" />
              A/B Test: Variant {ad.variant}
            </Badge>
          )}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.impressions.toLocaleString()}
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
                  {statsLoading ? '...' : stats?.clicks.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CTR</p>
                <p className="text-2xl font-bold">{ctr}%</p>
                {trend && (
                  <p className={`text-xs flex items-center gap-1 ${parseFloat(trend) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {parseFloat(trend) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trend}% vs last week
                  </p>
                )}
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
                <p className="text-sm text-muted-foreground">Play Rate</p>
                <p className="text-2xl font-bold">{playRate}%</p>
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
                  {statsLoading ? '...' : stats?.errors.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="trends">Performance Trends</TabsTrigger>
            {ad.ab_test_id && <TabsTrigger value="ab-test">A/B Test Results</TabsTrigger>}
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
              <CardDescription>
                Impressions, clicks, and CTR trends over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Loading analytics...
                </div>
              ) : analytics && analytics.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      className="text-xs"
                    />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                      name="Impressions"
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={false}
                      name="Clicks"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="ctr" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                      name="CTR %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {ad.ab_test_id && (
          <TabsContent value="ab-test">
            <Card>
              <CardHeader>
                <CardTitle>A/B Test Comparison</CardTitle>
                <CardDescription>
                  Performance comparison between all variants in this test
                </CardDescription>
              </CardHeader>
              <CardContent>
                {abTestResults && abTestResults.length > 0 ? (
                  <div className="space-y-6">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={abTestResults}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="variant" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="impressions" fill="hsl(var(--primary))" name="Impressions" />
                        <Bar dataKey="clicks" fill="#22c55e" name="Clicks" />
                        <Bar dataKey="plays" fill="#8b5cf6" name="Plays" />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {abTestResults.map((result) => (
                        <Card key={result.variant} className={result.variant === ad.variant ? 'ring-2 ring-primary' : ''}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant={result.variant === ad.variant ? 'default' : 'outline'}>
                                Variant {result.variant}
                              </Badge>
                              {result.variant === ad.variant && (
                                <span className="text-xs text-muted-foreground">Current</span>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">CTR:</span>
                                <span className="font-medium">{result.ctr.toFixed(2)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Play Rate:</span>
                                <span className="font-medium">{result.playRate.toFixed(2)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Impressions:</span>
                                <span className="font-medium">{result.impressions.toLocaleString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No A/B test data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="config">
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
                <div>
                  <p className="text-muted-foreground">Subscription Target</p>
                  <p className="font-medium capitalize">{ad.subscription_target}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">A/B Test</p>
                  <p className="font-medium">{ad.ab_test_id ? `Variant ${ad.variant}` : 'None'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}