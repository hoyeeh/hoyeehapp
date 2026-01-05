import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Calendar, 
  Bell, 
  BellOff, 
  Play, 
  Film, 
  Tv, 
  Search,
  ArrowLeft,
  Loader2,
  Clock,
  Star
} from "lucide-react";
import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { Logo } from "@/components/Logo";
import { useSEO } from "@/hooks/useSEO";

export default function ComingSoon() {
  useSEO({
    title: "Coming Soon - Upcoming Movies & TV Shows",
    description: "Browse upcoming movies and TV shows. Add to your watchlist to get notified when they're available.",
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [contentFilter, setContentFilter] = useState<"all" | "movie" | "series">("all");

  // Fetch coming soon items
  const { data: comingSoonItems = [], isLoading } = useQuery({
    queryKey: ["coming-soon-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon")
        .select("*")
        .eq("is_active", true)
        .order("expected_release_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user's watchlist
  const { data: watchlist = [] } = useQuery({
    queryKey: ["coming-soon-watchlist", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coming_soon_watchlist")
        .select("coming_soon_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map(w => w.coming_soon_id) || [];
    },
    enabled: !!user,
  });

  // Add to watchlist
  const addToWatchlist = useMutation({
    mutationFn: async (comingSoonId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("coming_soon_watchlist")
        .insert({ user_id: user.id, coming_soon_id: comingSoonId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coming-soon-watchlist"] });
      toast.success("Added to your watchlist! You'll be notified when it's available.");
    },
    onError: () => {
      toast.error("Failed to add to watchlist");
    },
  });

  // Remove from watchlist
  const removeFromWatchlist = useMutation({
    mutationFn: async (comingSoonId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("coming_soon_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("coming_soon_id", comingSoonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coming-soon-watchlist"] });
      toast.success("Removed from watchlist");
    },
    onError: () => {
      toast.error("Failed to remove from watchlist");
    },
  });

  const isInWatchlist = (id: string) => watchlist.includes(id);

  const toggleWatchlist = (id: string) => {
    if (!user) {
      toast.error("Please sign in to add to watchlist");
      navigate("/auth");
      return;
    }
    if (isInWatchlist(id)) {
      removeFromWatchlist.mutate(id);
    } else {
      addToWatchlist.mutate(id);
    }
  };

  // Filter items
  const filteredItems = comingSoonItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = contentFilter === "all" || item.content_type === contentFilter;
    return matchesSearch && matchesType;
  });

  // All filtered items for "All Upcoming" tab
  const upcomingItems = filteredItems;
  const myWatchlistItems = filteredItems.filter(item => isInWatchlist(item.id));

  const renderContentCard = (item: any) => {
    const isWatching = isInWatchlist(item.id);
    const releaseDate = item.expected_release_date ? parseISO(item.expected_release_date) : null;
    const isReleased = releaseDate ? isPast(releaseDate) : false;

    return (
      <div
        key={item.id}
        className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300"
      >
        {/* Image */}
        <div className="aspect-[2/3] relative overflow-hidden">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              {item.content_type === "movie" ? (
                <Film className="h-12 w-12 text-muted-foreground" />
              ) : (
                <Tv className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          
          {/* Content type badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm"
          >
            {item.content_type === "movie" ? (
              <><Film className="h-3 w-3 mr-1" /> Movie</>
            ) : (
              <><Tv className="h-3 w-3 mr-1" /> Series</>
            )}
          </Badge>

          {/* Release date badge */}
          {releaseDate && (
            <Badge 
              variant={isReleased ? "default" : "outline"}
              className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm"
            >
              <Clock className="h-3 w-3 mr-1" />
              {isReleased ? "Available Now" : formatDistanceToNow(releaseDate, { addSuffix: true })}
            </Badge>
          )}

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-bold text-white line-clamp-2">{item.title}</h3>
            
            {item.genre && (
              <p className="text-sm text-white/70 mt-1">{item.genre}</p>
            )}

            {releaseDate && (
              <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(releaseDate, "MMMM d, yyyy")}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-3">
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}

          <div className="flex gap-2">
            {item.trailer_url && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(item.trailer_url, "_blank")}
              >
                <Play className="h-4 w-4 mr-1" />
                Trailer
              </Button>
            )}
            
            <Button
              variant={isWatching ? "secondary" : "default"}
              size="sm"
              className="flex-1"
              onClick={() => toggleWatchlist(item.id)}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
            >
              {isWatching ? (
                <>
                  <BellOff className="h-4 w-4 mr-1" />
                  Remove
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-1" />
                  Notify Me
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Logo />
            </div>
            
            <div className="flex items-center gap-2">
              {user ? (
                <Button variant="outline" onClick={() => navigate("/profile")}>
                  Profile
                </Button>
              ) : (
                <Button onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-12 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Coming Soon
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse upcoming movies and TV shows. Add them to your watchlist to get notified when they become available.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-[73px] z-40 bg-background border-b border-border py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search upcoming content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={contentFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setContentFilter("all")}
              >
                All
              </Button>
              <Button
                variant={contentFilter === "movie" ? "default" : "outline"}
                size="sm"
                onClick={() => setContentFilter("movie")}
              >
                <Film className="h-4 w-4 mr-1" />
                Movies
              </Button>
              <Button
                variant={contentFilter === "series" ? "default" : "outline"}
                size="sm"
                onClick={() => setContentFilter("series")}
              >
                <Tv className="h-4 w-4 mr-1" />
                Series
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Calendar className="h-4 w-4" />
                All Upcoming ({upcomingItems.length})
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="gap-2">
                <Bell className="h-4 w-4" />
                My Watchlist ({myWatchlistItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {upcomingItems.length === 0 ? (
                <div className="text-center py-20">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No upcoming content</h3>
                  <p className="text-muted-foreground">Check back later for new releases!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {upcomingItems.map(renderContentCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="watchlist">
              {!user ? (
                <div className="text-center py-20">
                  <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Sign in to view your watchlist</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an account to save content and get notified when it's available.
                  </p>
                  <Button onClick={() => navigate("/auth")}>Sign In</Button>
                </div>
              ) : myWatchlistItems.length === 0 ? (
                <div className="text-center py-20">
                  <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Your watchlist is empty</h3>
                  <p className="text-muted-foreground">
                    Add upcoming content to get notified when it becomes available.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {myWatchlistItems.map(renderContentCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
