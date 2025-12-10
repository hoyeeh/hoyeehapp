import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Users, Film, CreditCard, TrendingUp, Tv, Star, Cloud, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AdminOverviewProps {
  users: any[];
  content: any[];
  subscriptions: any[];
}

export const AdminOverview = ({ users, content, subscriptions }: AdminOverviewProps) => {
  const [cdnConfigured, setCdnConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if CDN is configured by looking at env variable
    const cdnEndpoint = import.meta.env.VITE_DO_SPACES_CDN_ENDPOINT;
    setCdnConfigured(!!cdnEndpoint && cdnEndpoint.length > 0);
  }, []);

  const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;
  const totalRevenue = subscriptions
    .filter(s => s.status === "active")
    .reduce((acc, s) => acc + Number(s.amount), 0);
  
  const movies = content.filter(c => c.content_type === "movie").length;
  const series = content.filter(c => c.content_type === "series").length;
  const premiumContent = content.filter(c => c.is_premium).length;

  const stats = [
    { 
      icon: Users, 
      label: "Total Users", 
      value: users.length,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    { 
      icon: CreditCard, 
      label: "Active Subscriptions", 
      value: activeSubscriptions,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      icon: Film, 
      label: "Total Content", 
      value: content.length,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    { 
      icon: TrendingUp, 
      label: "Monthly Revenue", 
      value: `${totalRevenue.toLocaleString()} XAF`,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
  ];

  const contentStats = [
    { icon: Film, label: "Movies", value: movies },
    { icon: Tv, label: "TV Series", value: series },
    { icon: Star, label: "Premium", value: premiumContent },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display">Dashboard Overview</h2>

      {/* CDN Configuration Status */}
      <Card className={cn(
        "bg-card border-l-4",
        cdnConfigured === null ? "border-l-muted" : cdnConfigured ? "border-l-green-500" : "border-l-yellow-500"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                cdnConfigured === null ? "bg-muted/50" : cdnConfigured ? "bg-green-500/10" : "bg-yellow-500/10"
              )}>
                <Cloud className={cn(
                  "h-5 w-5",
                  cdnConfigured === null ? "text-muted-foreground" : cdnConfigured ? "text-green-500" : "text-yellow-500"
                )} />
              </div>
              <div>
                <p className="font-medium">CDN Configuration</p>
                <p className="text-sm text-muted-foreground">
                  {cdnConfigured === null 
                    ? "Checking..." 
                    : cdnConfigured 
                      ? "DigitalOcean Spaces CDN is configured and active" 
                      : "CDN not configured - videos served from origin"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cdnConfigured === null ? (
                <span className="text-sm text-muted-foreground">Loading...</span>
              ) : cdnConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                {stat.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Breakdown */}
      <Card className="bg-card">
        <CardHeader>
          <h3 className="font-semibold">Content Breakdown</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {contentStats.map((stat) => (
              <div key={stat.label} className="text-center p-4 bg-muted/50 rounded-lg">
                <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card">
        <CardHeader>
          <h3 className="font-semibold">Quick Actions</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left">
              <Film className="h-6 w-6 mb-2 text-primary" />
              <p className="font-medium">Add Content</p>
              <p className="text-sm text-muted-foreground">Upload new movie or series</p>
            </button>
            <button className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left">
              <Users className="h-6 w-6 mb-2 text-primary" />
              <p className="font-medium">Manage Users</p>
              <p className="text-sm text-muted-foreground">View and edit users</p>
            </button>
            <button className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left">
              <CreditCard className="h-6 w-6 mb-2 text-primary" />
              <p className="font-medium">Subscriptions</p>
              <p className="text-sm text-muted-foreground">Manage plans</p>
            </button>
            <button className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left">
              <TrendingUp className="h-6 w-6 mb-2 text-primary" />
              <p className="font-medium">Analytics</p>
              <p className="text-sm text-muted-foreground">View reports</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
