import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { TrendingUp, TrendingDown, Eye, Calendar, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface ContentPerformanceProps {
  contentId: string;
  contentTitle: string;
}

export function ContentPerformanceAnalytics({ contentId, contentTitle }: ContentPerformanceProps) {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  const { data: viewData, isLoading } = useQuery({
    queryKey: ['content-performance', contentId, period],
    queryFn: async () => {
      const days = parseInt(period);
      const startDate = subDays(new Date(), days);

      // Get view history for this content
      const { data: history, error } = await supabase
        .from('watch_history')
        .select('last_watched, progress, user_id')
        .eq('content_id', contentId)
        .gte('last_watched', startDate.toISOString())
        .order('last_watched', { ascending: true });

      if (error) throw error;

      // Group by date
      const dailyViews: Record<string, { views: number; uniqueUsers: Set<string>; completions: number }> = {};
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
        dailyViews[date] = { views: 0, uniqueUsers: new Set(), completions: 0 };
      }

      for (const item of history || []) {
        const date = format(new Date(item.last_watched), 'yyyy-MM-dd');
        if (dailyViews[date]) {
          dailyViews[date].views++;
          dailyViews[date].uniqueUsers.add(item.user_id);
          if (item.progress >= 90) {
            dailyViews[date].completions++;
          }
        }
      }

      // Convert to array
      const chartData = Object.entries(dailyViews).map(([date, data]) => ({
        date: format(new Date(date), 'MMM d'),
        views: data.views,
        uniqueViewers: data.uniqueUsers.size,
        completions: data.completions,
      }));

      // Calculate totals and trends
      const totalViews = chartData.reduce((sum, d) => sum + d.views, 0);
      const totalUnique = new Set(history?.map(h => h.user_id) || []).size;
      const totalCompletions = chartData.reduce((sum, d) => sum + d.completions, 0);

      // Calculate trend (compare last half to first half)
      const midpoint = Math.floor(chartData.length / 2);
      const firstHalfViews = chartData.slice(0, midpoint).reduce((sum, d) => sum + d.views, 0);
      const secondHalfViews = chartData.slice(midpoint).reduce((sum, d) => sum + d.views, 0);
      const trendPercent = firstHalfViews > 0 
        ? Math.round(((secondHalfViews - firstHalfViews) / firstHalfViews) * 100)
        : 0;

      return {
        chartData,
        totalViews,
        totalUnique,
        totalCompletions,
        trendPercent,
        avgDaily: Math.round(totalViews / days),
        completionRate: totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{contentTitle} - Performance</h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as "7" | "30" | "90")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Views</span>
            </div>
            <p className="text-2xl font-bold mt-1">{viewData?.totalViews || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Daily</span>
            </div>
            <p className="text-2xl font-bold mt-1">{viewData?.avgDaily || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {(viewData?.trendPercent || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-muted-foreground">Trend</span>
            </div>
            <p className={cn(
              "text-2xl font-bold mt-1",
              (viewData?.trendPercent || 0) >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {(viewData?.trendPercent || 0) >= 0 ? '+' : ''}{viewData?.trendPercent || 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">{viewData?.completionRate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">View Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={viewData?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px' 
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Views"
                />
                <Line 
                  type="monotone" 
                  dataKey="uniqueViewers" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Unique Viewers"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation */}
      {viewData && (
        <Card className={cn(
          "border-l-4",
          viewData.totalViews >= 50 ? "border-l-green-500" : "border-l-orange-500"
        )}>
          <CardContent className="pt-4">
            <h4 className="font-medium mb-2">AI Recommendation</h4>
            <p className="text-sm text-muted-foreground">
              {viewData.totalViews >= 50 ? (
                <>
                  This content has <strong className="text-green-500">{viewData.totalViews} views</strong> in the last {period} days, 
                  exceeding the 50-view threshold. <strong>Recommended to keep.</strong>
                </>
              ) : (
                <>
                  This content has only <strong className="text-orange-500">{viewData.totalViews} views</strong> in the last {period} days, 
                  below the 50-view threshold. Consider promoting or allowing it to be hidden.
                </>
              )}
              {viewData.trendPercent < -20 && (
                <span className="block mt-2 text-red-500">
                  ⚠️ Views are declining significantly ({viewData.trendPercent}%). May need promotional attention.
                </span>
              )}
              {viewData.trendPercent > 20 && (
                <span className="block mt-2 text-green-500">
                  📈 Views are trending upward (+{viewData.trendPercent}%). Content is gaining traction!
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
