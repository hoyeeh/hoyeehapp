import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Play, Plus, Check, ThumbsUp, Share2, Download, ChevronDown, Star, RotateCcw, Cast } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileContentCard } from "./MobileContentCard";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import logo from "@/assets/hoyeeh-logo-web.png";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { useProfileContext } from "@/contexts/ProfileContext";
import { MobileCastSheet } from "./MobileCastSheet";

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"episodes" | "more">(
    content.contentType === "series" ? "episodes" : "more"
  );
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const { lightTap, mediumTap, successFeedback, selectionTap } = useHaptics();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canAccessPremium } = useSubscriptionAccess();
  const { currentProfile } = useProfileContext();
  
  // Cast sheet state
  const [showCastSheet, setShowCastSheet] = useState(false);
  
  // Preview video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [showReplay, setShowReplay] = useState(false);
  const [previewTimer, setPreviewTimer] = useState(20);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Swipe to dismiss
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const scale = useTransform(y, [0, 300], [1, 0.9]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 && info.velocity.y > 0) {
      lightTap();
      onClose();
    }
  };
  
  // Preview video timer logic
  useEffect(() => {
    if (!content.videoUrl || !isPreviewPlaying) return;
    
    // Reset timer state
    setPreviewTimer(20);
    setShowReplay(false);
    
    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setPreviewTimer(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Stop after 20 seconds
    previewTimeoutRef.current = setTimeout(() => {
      setIsPreviewPlaying(false);
      setShowReplay(true);
      if (videoRef.current) {
        videoRef.current.pause();
      }
      lightTap();
    }, 20000);
    
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isPreviewPlaying, content.videoUrl, lightTap]);
  
  const handleReplayPreview = () => {
    mediumTap();
    if (videoRef.current) {
      videoRef.current.currentTime = 1200; // Start at 20 minutes
      videoRef.current.play();
    }
    setIsPreviewPlaying(true);
    setShowReplay(false);
    setPreviewTimer(20);
  };

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

  // Fetch user's existing rating
  const { data: userRating } = useQuery({
    queryKey: ["user-rating", content.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("content_id", content.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.rating || null;
    },
    enabled: !!user,
  });

  // Submit rating mutation
  const submitRating = useMutation({
    mutationFn: async (rating: number) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("content_id", content.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("reviews")
          .update({ rating })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("reviews")
          .insert({ content_id: content.id, user_id: user.id, rating });
      }
    },
    onSuccess: () => {
      successFeedback();
      queryClient.invalidateQueries({ queryKey: ["user-rating", content.id] });
      toast.success("Rating saved!");
      setShowRatingModal(false);
    },
    onError: () => {
      toast.error("Failed to save rating");
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

  const handlePlay = async () => {
    mediumTap();
    
    // Check kids profile restrictions
    if (currentProfile?.is_kids) {
      const rating = (content as any).contentRating;
      if (rating && !['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'].includes(rating)) {
        toast.error("This content is not available for Kids profiles");
        return;
      }
    }
    
    // All content requires premium subscription except for admins
    if (!canAccessPremium) {
      toast.error("Subscribe to watch this content");
      navigate("/subscription");
      return;
    }
    
    // For series, play first available episode
    if (content.contentType === "series") {
      if (episodes.length === 0) {
        toast.error("No episodes available yet");
        return;
      }
      const firstWithVideo = episodes.find((ep: any) => ep.video_url);
      if (!firstWithVideo) {
        toast.error("No playable episodes available");
        navigate(`/content/${content.id}`);
        onClose();
        return;
      }
      // Navigate to content detail with episode autoplay
      navigate(`/content/${content.id}?episodeId=${firstWithVideo.id}&autoplay=true`);
      onClose();
      return;
    }
    
    // For movies, check if video URL exists
    if (!content.videoUrl) {
      toast.error("Video not available yet");
      return;
    }
    
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
    if (!user) {
      toast.error("Please sign in to rate content");
      return;
    }
    setSelectedRating(userRating || 0);
    setShowRatingModal(true);
  };

  const handleShare = async () => {
    lightTap();
    const shareUrl = `${window.location.origin}/content/${content.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: content.title,
          text: content.description,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        successFeedback();
        toast.success("Link copied to clipboard!");
      } catch {
        toast.error("Failed to copy link");
      }
    }
  };

  const handleTabChange = (tab: "episodes" | "more") => {
    selectionTap();
    setActiveTab(tab);
  };

  return (
    <motion.div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-background"
      style={{ opacity, scale }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={handleDragEnd}
    >
      {/* Swipe indicator */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-muted-foreground/30 rounded-full z-10" />
      
      {/* Video Preview Area */}
      <div className="relative aspect-video bg-secondary">
        {content.videoUrl ? (
          <video
            ref={videoRef}
            src={`${content.videoUrl}#t=1200`}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            loop={false}
            poster={content.thumbnailUrl}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              video.currentTime = 1200; // Start at 20 minutes
              // Attempt play with error handling
              video.play().catch(() => {
                // Autoplay blocked, user will need to interact
              });
            }}
          />
        ) : (
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {/* Countdown Timer */}
        {content.videoUrl && isPreviewPlaying && previewTimer > 0 && (
          <div className="absolute top-4 left-4 bg-background/70 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className="text-xs font-medium">{previewTimer}s</span>
          </div>
        )}
        
        {/* Replay Button Overlay */}
        <AnimatePresence>
          {showReplay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <button
                onClick={handleReplayPreview}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-full",
                  "bg-primary/90 text-white",
                  "active:scale-95 transition-transform"
                )}
              >
                <RotateCcw className="h-8 w-8" />
                <span className="text-xs font-medium">Replay Preview</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
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
                "bg-primary text-white font-semibold",
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
              onClick={() => {
                lightTap();
                setShowCastSheet(true);
              }}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <Cast className="h-6 w-6" />
              <span className="text-xs text-muted-foreground">Cast</span>
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
                    <div 
                      key={ep.id} 
                      className="flex gap-3 active:opacity-70 transition-opacity cursor-pointer"
                      onClick={() => {
                        mediumTap();
                        if (!ep.video_url) {
                          toast.error("This episode is not yet available");
                          return;
                        }
                        if (ep.is_premium && !canAccessPremium) {
                          toast.error("This episode requires a premium subscription");
                          navigate("/subscription");
                          return;
                        }
                        // Navigate to content detail with episode to play
                        navigate(`/content/${content.id}?episodeId=${ep.id}`);
                      }}
                    >
                      <div className="relative w-32 aspect-video rounded-md overflow-hidden bg-secondary flex-shrink-0">
                        <img
                          src={ep.thumbnail_url || content.thumbnailUrl}
                          alt={ep.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                          <Play className="h-6 w-6 text-white" fill="currentColor" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium line-clamp-1">
                            {ep.episode_number}. {ep.title}
                          </h4>
                          <span className={cn(
                            "inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                            ep.video_url
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {ep.video_url ? "Available" : "Coming soon"}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            lightTap();
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
            <div className="mt-4">
              <h3 className="text-lg font-bold mb-4">More Like This</h3>
              <div className="grid grid-cols-3 gap-2">
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

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowRatingModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-bold text-center mb-2">Rate this title</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">{content.title}</p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      selectionTap();
                      setSelectedRating(star);
                    }}
                    className="p-2 active:scale-90 transition-transform"
                  >
                    <Star 
                      className={cn(
                        "h-10 w-10 transition-colors",
                        star <= selectedRating 
                          ? "text-yellow-500 fill-yellow-500" 
                          : "text-muted-foreground"
                      )} 
                    />
                  </button>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-medium active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedRating > 0 && submitRating.mutate(selectedRating)}
                  disabled={selectedRating === 0 || submitRating.isPending}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-medium active:scale-[0.98] transition-transform",
                    selectedRating > 0 
                      ? "bg-primary text-white" 
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {submitRating.isPending ? "Saving..." : "Submit"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cast Sheet */}
      <MobileCastSheet
        open={showCastSheet}
        onClose={() => setShowCastSheet(false)}
        videoUrl={content.videoUrl || ""}
        videoTitle={content.title}
        thumbnail={content.thumbnailUrl}
        currentTime={0}
        duration={content.duration || 0}
      />
    </motion.div>
  );
}
