import { useState } from "react";
import { ArrowLeft, Download, HardDrive, Play, Trash2, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Content } from "@/types";

interface KidsMobileDownloadsProps {
  onPlay: (content: Content) => void;
  onBack?: () => void;
}

interface DownloadItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  size: string;
  status: "completed" | "expired" | "downloading";
  expiresAt?: string;
  contentType: "movie" | "series";
  episodeInfo?: string;
  content?: Content;
}

export function KidsMobileDownloads({ onPlay, onBack }: KidsMobileDownloadsProps) {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const { lightTap, selectionTap, warningFeedback, successFeedback } = useHaptics();

  // Fetch download licenses for kids content only (G, PG ratings)
  const { data: downloads = [], isLoading, refetch } = useQuery({
    queryKey: ["kids-downloads", user?.id, currentProfile?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("download_licenses")
        .select(`
          id,
          content_id,
          quality,
          total_size,
          status,
          expires_at,
          downloaded_at,
          content:content_id (
            id, title, thumbnail_url, content_type, content_rating
          ),
          episode:episode_id (
            id, title, episode_number, season:season_id (season_number)
          )
        `)
        .eq("user_id", user.id)
        .order("downloaded_at", { ascending: false });

      if (error) throw error;
      
      // Filter to only kids-appropriate content (G, PG, TV-Y, TV-G, TV-PG)
      const kidsRatings = ["G", "PG", "TV-Y", "TV-Y7", "TV-G", "TV-PG"];
      
      return (data || [])
        .filter((item: any) => {
          const rating = item.content?.content_rating;
          return !rating || kidsRatings.includes(rating);
        })
        .map((item: any) => ({
          id: item.id,
          title: item.content?.title || "Unknown",
          thumbnailUrl: item.content?.thumbnail_url || "",
          size: formatBytes(item.total_size || 0),
          status: new Date(item.expires_at) < new Date() ? "expired" : item.status,
          expiresAt: item.expires_at,
          contentType: item.content?.content_type || "movie",
          episodeInfo: item.episode 
            ? `S${item.episode.season?.season_number || 1}:E${item.episode.episode_number}` 
            : undefined,
          content: item.content as Content,
        })) as DownloadItem[];
    },
    enabled: !!user,
  });

  // Calculate storage usage
  const storagePercentage = Math.min(downloads.length * 10, 100);

  const handleDelete = async (ids: string[]) => {
    warningFeedback();
    for (const id of ids) {
      await supabase.from("download_licenses").delete().eq("id", id);
    }
    setSelectedItems([]);
    setIsEditMode(false);
    successFeedback();
    toast.success(`${ids.length} download${ids.length > 1 ? "s" : ""} removed`);
    refetch();
  };

  const toggleSelect = (id: string) => {
    selectionTap();
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handlePlayItem = (item: DownloadItem) => {
    if (item.status === "expired") {
      toast.error("This download has expired");
      return;
    }
    if (item.content) {
      lightTap();
      onPlay(item.content);
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-6">
          {onBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                lightTap();
                onBack();
              }}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </motion.button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Download className="h-5 w-5 text-white stroke-[2.5]" />
            </div>
            <h1 className="text-xl font-bold text-white">My Downloads</h1>
          </div>
        </div>

        {/* Storage Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-white stroke-[2]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Storage</p>
              <p className="text-xs text-white/60">{downloads.length} items saved</p>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${storagePercentage}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </motion.div>
      </div>

      {/* Downloads List */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-28 aspect-video rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : downloads.length === 0 ? (
          // Empty state
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Download className="h-12 w-12 text-white/30 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Downloads Yet</h3>
            <p className="text-sm text-white/60 max-w-xs">
              Download your favorite shows to watch offline anytime!
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {downloads.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => isEditMode ? toggleSelect(item.id) : handlePlayItem(item)}
                className={cn(
                  "flex gap-3 p-2 rounded-2xl transition-all cursor-pointer",
                  isEditMode && "bg-white/5",
                  selectedItems.includes(item.id) && "bg-purple-500/20 ring-2 ring-purple-400/50"
                )}
              >
                {/* Thumbnail */}
                <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Status overlay */}
                  {item.status === "expired" ? (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-amber-400" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="h-4 w-4 text-slate-900 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {isEditMode && (
                    <div className={cn(
                      "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      selectedItems.includes(item.id) 
                        ? "bg-purple-500 border-purple-500" 
                        : "bg-slate-900/50 border-white/50"
                    )}>
                      {selectedItems.includes(item.id) && (
                        <CheckCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                  <h4 className="text-sm font-semibold text-white line-clamp-1">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {item.episodeInfo && (
                      <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                        {item.episodeInfo}
                      </span>
                    )}
                    <span className="text-xs text-white/50">{item.size}</span>
                  </div>
                  {item.status === "expired" ? (
                    <span className="text-xs text-amber-400 mt-1">Expired</span>
                  ) : item.expiresAt && (
                    <span className="text-xs text-white/40 mt-1">
                      Expires {formatDistanceToNow(new Date(item.expiresAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Edit Mode Toggle */}
      {downloads.length > 0 && (
        <div className="px-4 mt-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              lightTap();
              setIsEditMode(!isEditMode);
              if (isEditMode) setSelectedItems([]);
            }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors",
              isEditMode 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" 
                : "bg-white/10 text-white/80"
            )}
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">{isEditMode ? "Done" : "Edit"}</span>
          </motion.button>
        </div>
      )}

      {/* Delete Action Bar */}
      <AnimatePresence>
        {isEditMode && selectedItems.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 p-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl shadow-lg"
          >
            <button
              onClick={() => handleDelete(selectedItems)}
              className="w-full flex items-center justify-center gap-2 py-2 text-white font-semibold"
            >
              <Trash2 className="h-5 w-5" />
              Delete {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}