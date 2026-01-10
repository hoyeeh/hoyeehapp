import { useState } from "react";
import { ArrowLeft, Trash2, Play, Clock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MobileWatchHistoryProps {
  open: boolean;
  onClose: () => void;
}

export function MobileWatchHistory({ open, onClose }: MobileWatchHistoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const { lightTap, mediumTap } = useHaptics();
  const queryClient = useQueryClient();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { data: watchHistory = [], isLoading } = useQuery({
    queryKey: ["mobile-watch-history", user?.id, currentProfile?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("watch_history")
        .select("*, content:content_id(*)")
        .eq("user_id", user.id)
        .order("last_watched", { ascending: false })
        .limit(50);
      
      // Filter by profile if one is selected
      if (currentProfile?.id) {
        query = query.eq("profile_id", currentProfile.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open && !!currentProfile,
  });

  const handleClearHistory = async () => {
    if (!user?.id) return;
    setIsClearing(true);
    try {
      let query = supabase
        .from("watch_history")
        .delete()
        .eq("user_id", user.id);
      
      // Only clear for current profile if one is selected
      if (currentProfile?.id) {
        query = query.eq("profile_id", currentProfile.id);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["mobile-watch-history"] });
      toast.success("Watch history cleared");
      setShowClearConfirm(false);
    } catch (error) {
      toast.error("Failed to clear watch history");
    } finally {
      setIsClearing(false);
    }
  };

  const handlePlayContent = (contentId: string) => {
    lightTap();
    onClose();
    navigate(`/content/${contentId}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="flex flex-col h-full pt-safe">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  lightTap();
                  onClose();
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <h2 className="text-lg font-semibold text-foreground">Watch History</h2>
            </div>
            {watchHistory.length > 0 && (
              <button
                onClick={() => {
                  mediumTap();
                  setShowClearConfirm(true);
                }}
                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-28 h-16 bg-muted/30 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/30 rounded w-3/4" />
                      <div className="h-3 bg-muted/30 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : watchHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No watch history yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Content you watch will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {watchHistory.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => handlePlayContent(item.content_id)}
                    className="w-full flex gap-3 p-2 rounded-xl bg-muted/10 hover:bg-muted/20 active:scale-[0.98] transition-all"
                  >
                    <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0">
                      {item.content?.thumbnail_url ? (
                        <img
                          src={item.content.thumbnail_url}
                          alt={item.content.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                      {/* Progress bar */}
                      {item.progress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(item.progress * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {item.content?.title || "Unknown Title"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.content?.content_type === "series" ? "TV Show" : "Movie"}
                        {item.content?.year && ` • ${item.content.year}`}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {item.last_watched && new Date(item.last_watched).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <Play className="w-5 h-5 text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clear Confirmation Dialog */}
        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent className="max-w-[90vw] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Clear Watch History
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your entire watch history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2">
              <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearHistory}
                disabled={isClearing}
                className="flex-1 m-0 bg-destructive hover:bg-destructive/90"
              >
                {isClearing ? "Clearing..." : "Clear All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  );
}
