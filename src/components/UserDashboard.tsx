import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Play, Clock, Crown, Calendar, AlertTriangle, Loader2, Sparkles, Film, Tv } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, subDays } from "date-fns";

interface WatchHistoryWithContent {
  id: string;
  content_id: string;
  progress: number;
  last_watched: string;
  content: {
    id: string;
    title: string;
    thumbnail_url: string;
    duration: number;
    content_type: string;
  };
}

interface UserDashboardProps {
  onPlay: (content: Content) => void;
  onDetails?: (content: Content) => void;
}

export const UserDashboard = ({ onPlay, onDetails }: UserDashboardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const [canceling, setCanceling] = useState(false);

  // Fetch watch history with content details
  const { data: watchHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["watch-history-with-content", user?.id],
    queryFn: async (): Promise<WatchHistoryWithContent[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("watch_history")
        .select(`
          id,
          content_id,
          progress,
          last_watched,
          content:content_id (
            id,
            title,
            thumbnail_url,
            duration,
            content_type
          )
        `)
        .eq("user_id", user.id)
        .order("last_watched", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as unknown as WatchHistoryWithContent[];
    },
    enabled: !!user,
  });

  // Fetch recently added content (last 7 days)
  const { data: recentlyAdded = [] } = useQuery({
    queryKey: ["recently-added"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Filter to only show incomplete items (less than 90% watched)
  const continueWatching = watchHistory.filter((item) => {
    if (!item.content?.duration) return false;
    const percentWatched = (item.progress / item.content.duration) * 100;
    return percentWatched < 90 && percentWatched > 0;
  });

  const handleCancelSubscription = async () => {
    if (!user) return;
    
    setCanceling(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          is_subscribed: false,
          subscription_expiry: null 
        })
        .eq("id", user.id);

      if (error) throw error;

      await refetchProfile();
      toast.success("Subscription canceled successfully");
    } catch (error) {
      console.error("Cancel subscription error:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const handlePlayContent = (item: WatchHistoryWithContent) => {
    const content: Content = {
      id: item.content.id,
      title: item.content.title,
      thumbnailUrl: item.content.thumbnail_url || "",
      videoUrl: "",
      description: "",
      genre: "",
      contentType: item.content.content_type as "movie" | "series",
      isPremium: false,
      duration: item.content.duration || 0,
    };
    onPlay(content);
  };

  const handleContentClick = (item: any) => {
    const content: Content = {
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnail_url || "",
      videoUrl: item.video_url || "",
      description: item.description || "",
      genre: item.genre || "",
      contentType: item.content_type as "movie" | "series",
      isPremium: item.is_premium || false,
      duration: item.duration || 0,
    };
    onDetails?.(content);
  };

  const getProgressPercent = (progress: number, duration: number) => {
    if (!duration) return 0;
    return Math.min(100, Math.round((progress / duration) * 100));
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const subscriptionExpiry = profile?.subscription_expiry 
    ? new Date(profile.subscription_expiry) 
    : null;
  
  const daysUntilExpiry = subscriptionExpiry 
    ? differenceInDays(subscriptionExpiry, new Date()) 
    : null;

  return (
    <div className="space-y-8 px-4 md:px-12 py-8">
      {/* Continue Watching Section */}
      <section>
        <h2 className="font-display text-2xl md:text-3xl mb-6 flex items-center gap-2">
          <Clock className="h-7 w-7 text-brand" />
          Continue Watching
        </h2>
        
        {historyLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : continueWatching.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="py-12 text-center">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No content in progress</p>
              <p className="text-sm text-muted-foreground mt-2">Start watching something to see it here!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {continueWatching.map((item) => {
              const progressPercent = getProgressPercent(item.progress, item.content.duration);
              const remainingTime = item.content.duration - item.progress;
              
              return (
                <Card 
                  key={item.id} 
                  className="bg-card overflow-hidden group cursor-pointer hover:ring-2 hover:ring-brand transition-all"
                  onClick={() => handlePlayContent(item)}
                >
                  <div className="relative aspect-video">
                    <img
                      src={item.content.thumbnail_url || "/placeholder.svg"}
                      alt={item.content.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center">
                        <Play className="h-7 w-7 text-primary-foreground ml-1" fill="currentColor" />
                      </div>
                    </div>
                    <Progress 
                      value={progressPercent} 
                      className="absolute bottom-0 left-0 right-0 h-1 rounded-none bg-muted/50" 
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate">{item.content.title}</h3>
                    <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                      <span>{progressPercent}% watched</span>
                      <span>{formatDuration(remainingTime)} left</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently Added Section */}
      {recentlyAdded.length > 0 && (
        <section>
          <h2 className="font-display text-2xl md:text-3xl mb-6 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-brand" />
            Recently Added
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {recentlyAdded.map((item: any) => (
              <div
                key={item.id}
                className="cursor-pointer group"
                onClick={() => handleContentClick(item)}
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary relative">
                  <img
                    src={item.thumbnail_url || "/placeholder.svg"}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 px-2 py-0.5 rounded text-xs font-semibold text-white">
                    NEW
                  </div>
                  <div className="absolute bottom-2 left-2">
                    {item.content_type === "movie" ? (
                      <Film className="h-4 w-4 text-white drop-shadow" />
                    ) : (
                      <Tv className="h-4 w-4 text-white drop-shadow" />
                    )}
                  </div>
                </div>
                <h3 className="mt-2 font-medium truncate">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.year}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subscription Status Indicator */}
      <section>
        <h2 className="font-display text-2xl md:text-3xl mb-6 flex items-center gap-2">
          <Crown className="h-7 w-7 text-brand" />
          Subscription Status
        </h2>

        <Card className={`bg-card ${profile?.is_subscribed ? 'border-brand/30' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  profile?.is_subscribed ? 'bg-brand/20' : 'bg-secondary'
                }`}>
                  <Crown className={`h-7 w-7 ${profile?.is_subscribed ? 'text-brand' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {profile?.is_subscribed ? (
                      <>
                        Premium Member
                        <span className="px-2 py-0.5 bg-brand/20 text-brand text-xs font-semibold rounded-full">
                          ACTIVE
                        </span>
                      </>
                    ) : (
                      <>
                        Free Plan
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-semibold rounded-full">
                          LIMITED
                        </span>
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {profile?.is_subscribed 
                      ? "Enjoy unlimited access to all content" 
                      : "Upgrade to access premium content"}
                  </CardDescription>
                </div>
              </div>
              {profile?.is_subscribed && daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
                <div className="flex items-center gap-2 text-warning bg-warning/10 px-3 py-1.5 rounded-full">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Expires in {daysUntilExpiry} days</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.is_subscribed ? (
              <>
                {/* Plan Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Crown className="h-4 w-4" />
                      <span className="text-sm">Current Plan</span>
                    </div>
                    <p className="font-semibold text-lg">Monthly Premium</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Started On</span>
                    </div>
                    <p className="font-semibold">
                      {profile.created_at 
                        ? format(new Date(profile.created_at), "MMM d, yyyy") 
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Renewal Date</span>
                    </div>
                    <p className={`font-semibold ${daysUntilExpiry !== null && daysUntilExpiry <= 7 ? 'text-warning' : ''}`}>
                      {subscriptionExpiry 
                        ? format(subscriptionExpiry, "MMM d, yyyy") 
                        : "No expiry set"}
                    </p>
                  </div>
                </div>

                {/* Progress until renewal */}
                {subscriptionExpiry && profile.created_at && (
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Subscription Period</span>
                      <span>{daysUntilExpiry !== null ? `${daysUntilExpiry} days remaining` : ''}</span>
                    </div>
                    <Progress 
                      value={daysUntilExpiry !== null ? Math.max(0, 100 - ((daysUntilExpiry / 30) * 100)) : 0} 
                      className="h-2"
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    onClick={() => navigate("/subscription")}
                    className="bg-brand hover:bg-brand/90"
                  >
                    Renew Subscription
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                        Cancel Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel your premium subscription? 
                          You will lose access to all premium content immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelSubscription}
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={canceling}
                        >
                          {canceling ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Yes, Cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
                  <Crown className="h-8 w-8 text-brand" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Upgrade to Premium</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Unlock unlimited access to all movies, TV shows, and exclusive content with no ads
                </p>
                <Button 
                  onClick={() => navigate("/subscription")}
                  size="lg"
                  className="bg-brand hover:bg-brand/90"
                >
                  <Crown className="h-5 w-5 mr-2" />
                  Get Premium Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
