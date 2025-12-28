import { useNavigate } from "react-router-dom";
import { useUserPurchases } from "@/hooks/usePaidContent";
import { ShoppingBag, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";

interface MobilePurchasesShortcutProps {
  onPlay?: (content: Content) => void;
  onDetails?: (content: Content) => void;
}

export function MobilePurchasesShortcut({ onPlay, onDetails }: MobilePurchasesShortcutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: purchases = [], isLoading } = useUserPurchases();

  if (!user) return null;
  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (purchases.length === 0) return null;

  // Get the 3 most recent purchases for preview
  const recentPurchases = purchases.slice(0, 3);

  const handleContentClick = (purchase: any) => {
    if (onDetails && purchase.content) {
      const content: Content = {
        id: purchase.content.id,
        title: purchase.content.title,
        description: purchase.content.description || '',
        thumbnailUrl: purchase.content.thumbnail_url || '/placeholder.svg',
        videoUrl: purchase.content.video_url || '',
        genre: purchase.content.genre || '',
        contentType: purchase.content.content_type as 'movie' | 'series',
        isPremium: purchase.content.is_premium || false,
        duration: purchase.content.duration || 0,
        year: purchase.content.year,
        rating: purchase.content.rating,
        contentRating: purchase.content.content_rating,
      };
      onDetails(content);
    }
  };

  return (
    <div className="px-4 py-2">
      <div 
        className="bg-gradient-to-r from-green-500/20 via-emerald-500/15 to-teal-500/10 border border-green-500/30 rounded-xl p-4 cursor-pointer hover:bg-green-500/25 transition-colors"
        onClick={() => navigate('/my-purchases')}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">My Purchases</h3>
              <p className="text-xs text-muted-foreground">{purchases.length} item{purchases.length !== 1 ? 's' : ''} unlocked</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Recent purchases preview */}
        <div className="flex gap-2 overflow-hidden">
          {recentPurchases.map((purchase: any) => (
            <div 
              key={purchase.id} 
              className="relative flex-shrink-0 w-16 h-24 rounded-md overflow-hidden group"
              onClick={(e) => {
                e.stopPropagation();
                handleContentClick(purchase);
              }}
            >
              <img 
                src={purchase.content?.thumbnail_url || '/placeholder.svg'} 
                alt={purchase.content?.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-1 left-1 right-1">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mx-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-3 w-3 text-white ml-0.5" fill="white" />
                </div>
              </div>
              {/* Paid Access ribbon */}
              <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-[8px] font-bold text-center py-0.5">
                PAID
              </div>
            </div>
          ))}
          {purchases.length > 3 && (
            <div className="flex-shrink-0 w-16 h-24 rounded-md bg-secondary/50 flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">+{purchases.length - 3}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
