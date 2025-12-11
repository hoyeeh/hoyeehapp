import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useAllUsers, useAllSubscriptions, useAdminContent } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Loader2, ArrowLeft, Users, Film, CreditCard, TrendingUp, 
  Eye, Calendar, Clock, BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

const COLORS = ['#ff6300', '#b64700', '#ff8533', '#cc5200', '#ff9955'];

const Analytics = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: users = [] } = useAllUsers();
  const { data: subscriptions = [] } = useAllSubscriptions();
  const { data: content = [] } = useAdminContent();
  
  const [watchHistoryData, setWatchHistoryData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && isAdmin === false) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    const fetchWatchHistory = async () => {
      const { data, error } = await supabase
        .from("watch_history")
        .select("*, content(title)")
        .order("last_watched", { ascending: false })
        .limit(100);

      if (!error && data) {
        setWatchHistoryData(data);
      }
    };
    fetchWatchHistory();
  }, []);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand" />
      </div>
    );
  }

  if (!isAdmin) return null;

  // Calculate metrics
  const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;
  const totalRevenue = subscriptions
    .filter(s => s.status === "active")
    .reduce((acc, s) => acc + Number(s.amount), 0);

  // Daily revenue (today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyRevenue = subscriptions
    .filter(s => {
      if (!s.created_at) return false;
      const createdDate = new Date(s.created_at);
      createdDate.setHours(0, 0, 0, 0);
      return createdDate.getTime() === today.getTime() && s.status === "active";
    })
    .reduce((acc, s) => acc + Number(s.amount), 0);

  // Weekly revenue (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyRevenue = subscriptions
    .filter(s => {
      if (!s.created_at) return false;
      const createdDate = new Date(s.created_at);
      return createdDate >= weekAgo && s.status === "active";
    })
    .reduce((acc, s) => acc + Number(s.amount), 0);
  
  const subscribedUsers = users.filter(u => u.is_subscribed).length;
  const conversionRate = users.length > 0 ? ((subscribedUsers / users.length) * 100).toFixed(1) : 0;

  // Calculate user signups over time
  const userSignupsByDay = users.reduce((acc: any, user) => {
    if (!user.created_at) return acc;
    const date = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const signupChartData = Object.entries(userSignupsByDay)
    .slice(-14)
    .map(([date, count]) => ({ date, signups: count }));

  // Content type distribution
  const contentByType = content.reduce((acc: any, item) => {
    const type = item.content_type || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const contentTypeData = Object.entries(contentByType).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Subscription status distribution
  const subscriptionsByStatus = subscriptions.reduce((acc: any, sub) => {
    acc[sub.status] = (acc[sub.status] || 0) + 1;
    return acc;
  }, {});

  const subscriptionStatusData = Object.entries(subscriptionsByStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Top viewed content
  const topContent = [...content]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 5);

  // Monthly revenue calculation
  const revenueByMonth = subscriptions
    .filter(s => s.status === "active" && s.created_at)
    .reduce((acc: any, sub) => {
      const month = new Date(sub.created_at!).toLocaleDateString('en-US', { month: 'short' });
      acc[month] = (acc[month] || 0) + Number(sub.amount);
      return acc;
    }, {});

  const revenueChartData = Object.entries(revenueByMonth).map(([month, revenue]) => ({
    month,
    revenue,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
          <span className="text-muted-foreground">/ Analytics</span>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
            </Button>
          ))}
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">
                {subscribedUsers} premium
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Conversion Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-brand">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">
                Free to premium
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Daily Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-500">{dailyRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XAF today</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-500" />
                Weekly Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold text-amber-500">{weeklyRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XAF this week</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Monthly Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XAF</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                Total Content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{content.length}</p>
              <p className="text-xs text-muted-foreground">
                {content.filter(c => c.is_premium).length} premium
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* User Growth */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand" />
                User Signups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signupChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="signups" 
                      stroke="#ff6300" 
                      fill="#ff6300" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-brand" />
                Revenue by Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="month" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value) => [`${Number(value).toLocaleString()} XAF`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#ff6300" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Charts */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Content Distribution */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-brand" />
                Content by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={contentTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {contentTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Status */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-brand" />
                Subscription Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {subscriptionStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Content */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-brand" />
                Top Viewed Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topContent.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-brand w-6">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.view_count || 0} views
                      </p>
                    </div>
                  </div>
                ))}
                {topContent.length === 0 && (
                  <p className="text-sm text-muted-foreground">No view data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand" />
              Recent Watch Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {watchHistoryData.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{(item.content as any)?.title || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.progress}% watched
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.last_watched && new Date(item.last_watched).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {watchHistoryData.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No watch activity yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;