import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  Bell, 
  Calendar, 
  Film, 
  Tv,
  CheckCircle,
  Clock
} from "lucide-react";
import { format, subDays, startOfDay, parseISO } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#10b981", "#f59e0b"];

export const ComingSoonAnalytics = () => {
  // Fetch sync history for analytics
  const { data: syncHistory = [], isLoading: loadingSyncHistory } = useQuery({
    queryKey: ["coming-soon-sync-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon_sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch coming soon items
  const { data: comingSoonItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["coming-soon-items-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch watchlist data
  const { data: watchlistData = [], isLoading: loadingWatchlist } = useQuery({
    queryKey: ["coming-soon-watchlist-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon_watchlist")
        .select("coming_soon_id, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingSyncHistory || loadingItems || loadingWatchlist;

  // Calculate metrics
  const totalSynced = syncHistory.length;
  const totalNotifications = syncHistory.reduce((sum, log) => sum + (log.users_notified || 0), 0);
  const activeItems = comingSoonItems.filter(item => item.is_active).length;
  const totalWatchlistAdds = watchlistData.length;

  // Content type distribution
  const contentTypeData = [
    { name: "Movies", value: comingSoonItems.filter(i => i.content_type === "movie").length },
    { name: "Series", value: comingSoonItems.filter(i => i.content_type === "series").length },
  ].filter(d => d.value > 0);

  // Sync activity over last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const dateStr = format(date, "MMM d");
    const syncs = syncHistory.filter(log => {
      const logDate = startOfDay(parseISO(log.synced_at));
      return logDate.getTime() === date.getTime();
    });
    return {
      date: dateStr,
      synced: syncs.length,
      notified: syncs.reduce((sum, log) => sum + (log.users_notified || 0), 0),
    };
  });

  // Watchlist additions over last 7 days
  const watchlistTrend = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const dateStr = format(date, "MMM d");
    const adds = watchlistData.filter(w => {
      const addDate = startOfDay(parseISO(w.created_at));
      return addDate.getTime() === date.getTime();
    }).length;
    return { date: dateStr, adds };
  });

  // Most watched items (by watchlist count)
  const watchlistByItem = watchlistData.reduce((acc, w) => {
    acc[w.coming_soon_id] = (acc[w.coming_soon_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topWatchedItems = Object.entries(watchlistByItem)
    .map(([id, count]) => {
      const item = comingSoonItems.find(i => i.id === id);
      return { title: item?.title || "Unknown", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Synced</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSynced}</div>
            <p className="text-xs text-muted-foreground">Items auto-synced to content</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNotifications}</div>
            <p className="text-xs text-muted-foreground">Total push notifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Items</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeItems}</div>
            <p className="text-xs text-muted-foreground">Currently coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist Adds</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWatchlistAdds}</div>
            <p className="text-xs text-muted-foreground">User watchlist entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sync Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Bar dataKey="synced" fill="hsl(var(--primary))" name="Items Synced" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notified" fill="hsl(var(--secondary))" name="Users Notified" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Content Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contentTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={contentTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {contentTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))" 
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No content data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watchlist Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Watchlist Additions (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={watchlistTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="adds" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                  name="Watchlist Adds"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Watched Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Most Anticipated Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topWatchedItems.length > 0 ? (
              <div className="space-y-4">
                {topWatchedItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} {item.count === 1 ? "user" : "users"} watching
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No watchlist data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
