import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Eye, Clock, Users, DollarSign } from "lucide-react";
import { useCreatorAnalytics, useCreatorReports } from "@/hooks/useCreatorAnalytics";
import { useState } from "react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";

interface AnalyticsDashboardProps {
  creatorId: string;
}

export function AnalyticsDashboard({ creatorId }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const { data: analytics, isLoading } = useCreatorAnalytics(creatorId, period);
  const { data: reports = [] } = useCreatorReports(creatorId);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatWatchTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  // Calculate totals from analytics data
  const totals = analytics?.reduce((acc: any, day: any) => ({
    views: acc.views + day.views,
    uniqueViewers: acc.uniqueViewers + day.unique_viewers,
    watchTime: acc.watchTime + day.watch_time_minutes,
    newFollowers: acc.newFollowers + day.new_followers,
    sales: acc.sales + day.sales,
    revenue: acc.revenue + Number(day.revenue),
    tips: acc.tips + Number(day.tips_received),
  }), { views: 0, uniqueViewers: 0, watchTime: 0, newFollowers: 0, sales: 0, revenue: 0, tips: 0 }) || { views: 0, uniqueViewers: 0, watchTime: 0, newFollowers: 0, sales: 0, revenue: 0, tips: 0 };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Overview
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatNumber(totals.views)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Unique Viewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatNumber(totals.uniqueViewers)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Watch Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatWatchTime(totals.watchTime)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              New Followers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-500">+{formatNumber(totals.newFollowers)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-primary">{formatCurrency(totals.revenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-primary">{formatCurrency(totals.tips)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      {analytics && analytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Daily Performance</CardTitle>
            <CardDescription>Detailed breakdown by day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.slice(0, 7).map((day: any) => (
                <div 
                  key={day.date} 
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{format(new Date(day.date), 'EEEE, MMM d')}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.views} views • {formatWatchTime(day.watch_time_minutes)} watch time
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-500">
                      {formatCurrency(Number(day.revenue) + Number(day.tips_received))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +{day.new_followers} followers
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Reports</CardTitle>
            <CardDescription>Your weekly and monthly reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reports.slice(0, 5).map((report: any) => (
                <div 
                  key={report.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium capitalize">{report.report_type} Report</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(report.period_start), 'MMM d')} - {format(new Date(report.period_end), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(report.generated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      )}

      {!isLoading && (!analytics || analytics.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No analytics data yet</p>
            <p className="text-sm text-muted-foreground">
              Analytics will appear here once your content gets views
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
