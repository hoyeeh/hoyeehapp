import { useState } from "react";
import { X, Play, Plus, Check, ThumbsUp, Share2, Download, ChevronDown } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileContentCard } from "./MobileContentCard";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import logo from "@/assets/hoyeeh-logo-web.png";

interface MobileContentDetailProps {
  content: Content;
  onClose: () => void;
  onPlay: (content: Content) => void;
  isInList?: boolean;
  onToggleList?: (content: Content) => void;
}

export function MobileContentDetail({ 
  content, 
  onClose, 
  onPlay,
  isInList = false,
  onToggleList
}: MobileContentDetailProps) {
  const [activeTab, setActiveTab] = useState<"episodes" | "more">("more");
  const { lightTap, mediumTap, successFeedback, selectionTap } = useHaptics();

  // Fetch similar content
  const { data: similarContent = [] } = useQuery({
    queryKey: ["similar-content", content.genre],
    queryFn: async () => {
      if (!content.genre) return [];
      const genres = content.genre.split(",").map(g => g.trim().toLowerCase());
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .neq("id", content.id)
        .limit(12);
      
      if (error) throw error;
      
      // Filter by similar genre
      const similar = data?.filter((item: any) => {
        const itemGenres = (item.genre || "").toLowerCase();
        return genres.some(g => itemGenres.includes(g));
      }) || [];
      
      return similar.slice(0, 9).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description || "",
        thumbnailUrl: item.thumbnail_url || "",
        videoUrl: item.video_url || "",
        genre: item.genre || "",
        contentType: item.content_type as "movie" | "series",
        isPremium: item.is_premium || false,
        duration: item.duration || 0,
        year: item.year,
      }));
    },
  });

  // Fetch episodes if TV series
  const { data: episodes = [] } = useQuery({
    queryKey: ["content-episodes", content.id],
    queryFn: async () => {
      if (content.contentType !== "series") return [];
      
      const { data: seasons, error: seasonsError } = await supabase
        .from("seasons")
        .select("id, season_number")
        .eq("content_id", content.id)
        .order("season_number")
        .limit(1);
      
      if (seasonsError || !seasons?.length) return [];

      const { data: eps, error: epsError } = await supabase
        .from("episodes")
        .select("*")
        .eq("season_id", seasons[0].id)
        .order("episode_number")
        .limit(10);
      
      if (epsError) throw epsError;
      return eps || [];
    },
    enabled: content.contentType === "series",
  });

  const handleClose = () => {
    lightTap();
    onClose();
  };

  const handlePlay = () => {
    mediumTap();
    onPlay(content);
  };

  const handleDownload = () => {
    lightTap();
    toast.info("Download started");
  };

  const handleToggleList = () => {
    selectionTap();
    onToggleList?.(content);
    if (!isInList) {
      successFeedback();
      toast.success("Added to My List");
    } else {
      toast.success("Removed from My List");
    }
  };

  const handleRate = () => {
    lightTap();
    toast.info("Rating feature coming soon");
  };

  const handleShare = () => {
    lightTap();
    if (navigator.share) {
      navigator.share({
        title: content.title,
        text: content.description,
        url: window.location.href,
      });
    } else {
      toast.info("Share link copied!");
    }
  };

  const handleTabChange = (tab: "episodes" | "more") => {
    selectionTap();
    setActiveTab(tab);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background animate-in fade-in slide-in-from-bottom duration-300">
      {/* Video Preview Area */}
      <div className="relative aspect-video bg-secondary">
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="w-full h-full object-cover"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 bg-background/50 backdrop-blur-sm rounded-full hover:bg-background/70 transition-colors active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Progress bar placeholder */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div className="h-full bg-primary w-0" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto h-[calc(100vh-56.25vw)] pb-safe">
        <div className="p-4 space-y-4">
          {/* Logo */}
          <img src={logo} alt="Hoyeeh" className="h-5 w-auto" />

          {/* Title */}
          <h1 className="text-2xl font-bold">{content.title}</h1>

          {/* Meta Info */}
          <div className="flex items-center flex-wrap gap-2 text-sm">
            {content.year && <span className="text-green-500 font-medium">{content.year}</span>}
            {content.contentRating && (
              <span className="px-1.5 py-0.5 border border-border rounded text-xs">
                {content.contentRating}
              </span>
            )}
            {content.contentType === "series" && (
              <span className="text-muted-foreground">TV Series</span>
            )}
            {content.duration && content.duration > 0 && (
              <span className="text-muted-foreground">
                {Math.floor(content.duration / 3600) > 0 
                  ? `${Math.floor(content.duration / 3600)}h ${Math.floor((content.duration % 3600) / 60)}m`
                  : `${Math.floor(content.duration / 60)}m`}
              </span>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handlePlay}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-md",
                "bg-foreground text-background font-semibold",
                "active:scale-[0.98] transition-transform"
              )}
            >
              <Play className="h-5 w-5" fill="currentColor" />
              Play
            </button>
            
            <button
              onClick={handleDownload}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-md",
                "bg-secondary text-foreground font-medium",
                "border border-border/50",
                "active:scale-[0.98] transition-transform"
              )}
            >
              <Download className="h-5 w-5" />
              Download
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content.description}
          </p>

          {/* Genre */}
          {content.genre && (
            <p className="text-xs text-muted-foreground">
              <span className="text-muted-foreground/70">Genre: </span>
              {content.genre}
            </p>
          )}

          {/* Action Icons Row */}
          <div className="flex items-center justify-around py-4 border-t border-b border-border/30">
            <button 
              onClick={handleToggleList}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              {isInList ? (
                <Check className="h-6 w-6 text-primary" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
              <span className="text-xs text-muted-foreground">My List</span>
            </button>
            
            <button 
              onClick={handleRate}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <ThumbsUp className="h-6 w-6" />
              <span className="text-xs text-muted-foreground">Rate</span>
            </button>
            
            <button 
              onClick={handleShare}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <Share2 className="h-6 w-6" />
              <span className="text-xs text-muted-foreground">Share</span>
            </button>
          </div>

          {/* Tabs for Series */}
          {content.contentType === "series" && (
            <div className="flex gap-6 border-b border-border/30">
              <button
                onClick={() => handleTabChange("episodes")}
                className={cn(
                  "pb-2 text-sm font-medium transition-colors relative",
                  activeTab === "episodes" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Episodes
                {activeTab === "episodes" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => handleTabChange("more")}
                className={cn(
                  "pb-2 text-sm font-medium transition-colors relative",
                  activeTab === "more" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                More Like This
                {activeTab === "more" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          )}

          {/* Episodes List */}
          {content.contentType === "series" && activeTab === "episodes" && (
            <div className="space-y-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-md active:scale-95 transition-transform">
                <span className="text-sm font-medium">Season 1</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {episodes.length > 0 ? (
                <div className="space-y-4">
                  {episodes.map((ep: any) => (
                    <div key={ep.id} className="flex gap-3 active:opacity-70 transition-opacity">
                      <div className="relative w-32 aspect-video rounded-md overflow-hidden bg-secondary flex-shrink-0">
                        <img
                          src={ep.thumbnail_url || content.thumbnailUrl}
                          alt={ep.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                          <Play className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium line-clamp-1">
                            {ep.episode_number}. {ep.title}
                          </h4>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info("Episode download started");
                            }}
                            className="active:scale-95 transition-transform"
                          >
                            <Download className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {ep.duration ? `${Math.floor(ep.duration / 60)}m` : ""}
                        </span>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {ep.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No episodes available yet
                </p>
              )}
            </div>
          )}

          {/* More Like This */}
          {(content.contentType === "movie" || activeTab === "more") && (
            <div>
              <h3 className="text-lg font-bold mb-4">More Like This</h3>
              <div className="grid grid-cols-3 gap-3">
                {similarContent.map((item: Content) => (
                  <MobileContentCard
                    key={item.id}
                    content={item}
                    onDetails={(c) => {
                      lightTap();
                      onClose();
                    }}
                    variant="poster"
                    showBadges={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
