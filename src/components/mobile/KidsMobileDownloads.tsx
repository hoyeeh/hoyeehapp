import { useState } from "react";
import { ArrowLeft, Download, HardDrive, Play, Trash2, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { formatDistanceToNow } from "date-fns";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Content } from "@/types";

interface KidsMobileDownloadsProps {
  onPlay: (content: Content) => void;
  onBack?: () => void;
}
import { KIDS_MAX_AGE_LIMIT } from "@/constants/kidsRatings";

// Kids-appropriate content ratings
const KIDS_RATINGS_LOCAL = ["G", "PG", "TV-Y", "TV-Y7", "TV-G", "TV-PG"];

export function KidsMobileDownloads({ onPlay, onBack }: KidsMobileDownloadsProps) {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const { lightTap, selectionTap, warningFeedback, successFeedback } = useHaptics();
  
  // Use unified download manager
  const {
    downloads: allDownloads,
    isLoading,
    deleteDownload,
    getOfflineVideoUrl,
    getLicenseExpiry,
    formatBytes,
    loadDownloads,
  } = useDownloadManager();

  // Filter to only show completed downloads with kids-appropriate ratings
  const downloads = allDownloads.filter(d => {
    if (d.status !== 'completed') return false;
    // Filter by content rating if available - only G and PG for kids
    const rating = d.contentRating;
    return !rating || KIDS_RATINGS_LOCAL.includes(rating);
  });

  // Calculate storage usage
  const totalSize = downloads.reduce((acc, d) => acc + d.downloadedSize, 0);
  const storagePercentage = Math.min((totalSize / (5 * 1024 * 1024 * 1024)) * 100, 100); // 5GB limit for kids

  const handleDelete = async (ids: string[]) => {
    warningFeedback();
    for (const id of ids) {
      const download = downloads.find(d => d.id === id);
      if (download) {
        await deleteDownload(download.contentId, download.episodeId);
      }
    }
    setSelectedItems([]);
    setIsEditMode(false);
    successFeedback();
    toast.success(`${ids.length} download${ids.length > 1 ? "s" : ""} removed`);
  };

  const toggleSelect = (id: string) => {
    selectionTap();
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handlePlayItem = async (download: typeof downloads[0]) => {
    // Check license expiry
    const expiry = await getLicenseExpiry(download.contentId, download.episodeId);
    if (expiry && expiry < Date.now()) {
      toast.error("This download has expired");
      return;
    }
    
    // Get offline video URL
    const offlineUrl = await getOfflineVideoUrl(download.contentId, download.episodeId);
    if (!offlineUrl) {
      toast.error("Failed to load offline video");
      return;
    }
    
    lightTap();
    
    // Create content object for playback
    const content: Content = {
      id: download.contentId,
      title: download.title,
      description: '',
      thumbnailUrl: download.thumbnailUrl || '',
      videoUrl: offlineUrl,
      contentType: 'movie',
      genre: '',
      year: 0,
      rating: '',
      duration: download.duration,
      isPremium: false,
      contentRating: download.contentRating || 'G',
    };
    
    onPlay(content);
  };

  const getExpiryStatus = async (download: typeof downloads[0]) => {
    const expiry = await getLicenseExpiry(download.contentId, download.episodeId);
    return expiry ? (expiry < Date.now() ? 'expired' : 'valid') : 'unknown';
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
              <p className="text-xs text-white/60">{downloads.length} items saved • {formatBytes(totalSize)}</p>
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
              <DownloadItem
                key={item.id}
                item={item}
                index={index}
                isEditMode={isEditMode}
                isSelected={selectedItems.includes(item.id)}
                onSelect={() => toggleSelect(item.id)}
                onPlay={() => handlePlayItem(item)}
                getLicenseExpiry={getLicenseExpiry}
                formatBytes={formatBytes}
              />
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

// Separate component for download item to handle async expiry check
function DownloadItem({
  item,
  index,
  isEditMode,
  isSelected,
  onSelect,
  onPlay,
  getLicenseExpiry,
  formatBytes,
}: {
  item: any;
  index: number;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  getLicenseExpiry: (contentId: string, episodeId?: string) => Promise<number | null>;
  formatBytes: (bytes: number) => string;
}) {
  const [expiry, setExpiry] = useState<number | null>(null);
  
  // Load expiry on mount
  useState(() => {
    getLicenseExpiry(item.contentId, item.episodeId).then(setExpiry);
  });

  const isExpired = expiry ? expiry < Date.now() : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => isEditMode ? onSelect() : onPlay()}
      className={cn(
        "flex gap-3 p-2 rounded-2xl transition-all cursor-pointer",
        isEditMode && "bg-white/5",
        isSelected && "bg-purple-500/20 ring-2 ring-purple-400/50"
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
        <img
          src={item.thumbnailUrl || '/placeholder.svg'}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        
        {/* Status overlay */}
        {isExpired ? (
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
            isSelected 
              ? "bg-purple-500 border-purple-500" 
              : "bg-slate-900/50 border-white/50"
          )}>
            {isSelected && (
              <CheckCircle className="h-4 w-4 text-white" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        <h4 className="text-sm font-semibold text-white line-clamp-1">
          {item.episodeTitle || item.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          {item.episodeTitle && (
            <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
              {item.title}
            </span>
          )}
          <span className="text-xs text-white/50">{formatBytes(item.downloadedSize)}</span>
        </div>
        {isExpired ? (
          <span className="text-xs text-amber-400 mt-1">Expired</span>
        ) : expiry && (
          <span className="text-xs text-white/40 mt-1">
            Expires {formatDistanceToNow(new Date(expiry), { addSuffix: true })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
