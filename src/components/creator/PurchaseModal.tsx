import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHasPurchasedContent } from "@/hooks/useCreator";
import { useInitializePurchase } from "@/hooks/usePaidContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Play, ShoppingBag, Loader2, CreditCard, Smartphone, Clock, Star, User } from "lucide-react";
import { toast } from "sonner";

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  paidContent: any;
}

export function PurchaseModal({ open, onClose, paidContent }: PurchaseModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const content = paidContent?.content;
  const creator = paidContent?.creator_profiles;
  
  const { data: hasPurchased, isLoading: checkingPurchase } = useHasPurchasedContent(content?.id);
  const initializePurchase = useInitializePurchase();
  
  const [isPurchasing, setIsPurchasing] = useState(false);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Please sign in to purchase");
      navigate('/auth');
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await initializePurchase.mutateAsync(content.id);
      if (result.paymentLink) {
        // Open payment in new tab
        window.open(result.paymentLink, '_blank');
        toast.info("Complete your payment in the new tab");
        onClose();
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleWatch = () => {
    onClose();
    navigate(`/content/${content.id}`);
  };

  if (!paidContent || !content) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Preview Image/Video */}
        <div className="relative aspect-video">
          <img
            src={content.thumbnail_url || '/placeholder.svg'}
            alt={content.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          {/* Price Badge */}
          <div className="absolute top-4 right-4">
            <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2 font-bold">
              {formatPrice(paidContent.price, paidContent.currency)}
            </Badge>
          </div>

          {/* Play Preview Button */}
          {content.video_url && (
            <Button
              variant="secondary"
              size="lg"
              className="absolute bottom-4 left-4 gap-2"
            >
              <Play className="h-5 w-5" />
              Preview
            </Button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Title & Type */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{content.content_type === 'series' ? 'TV Series' : 'Movie'}</Badge>
              {content.genre && <Badge variant="secondary">{content.genre}</Badge>}
              {content.year && <span className="text-sm text-muted-foreground">{content.year}</span>}
            </div>
            <h2 className="text-2xl font-bold">{content.title}</h2>
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            {creator?.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.display_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{creator?.display_name}</span>
                {creator?.is_verified && (
                  <CheckCircle className="h-4 w-4 text-primary" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">Content Creator</span>
            </div>
          </div>

          {/* Description */}
          {content.description && (
            <p className="text-muted-foreground line-clamp-3">{content.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            {paidContent.sale_count > 0 && (
              <div className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                {paidContent.sale_count} purchases
              </div>
            )}
            {content.duration && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.floor(content.duration / 60)}h {content.duration % 60}m
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Methods Info */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Accepted Payment Methods</p>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1 text-sm">
                <Smartphone className="h-4 w-4" />
                Mobile Money
              </div>
              <div className="flex items-center gap-1 text-sm">
                <CreditCard className="h-4 w-4" />
                Card Payment
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {checkingPurchase ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : hasPurchased ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500 justify-center">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">You own this content</span>
              </div>
              <Button onClick={handleWatch} className="w-full gap-2" size="lg">
                <Play className="h-5 w-5" />
                Watch Now
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handlePurchase} 
                disabled={isPurchasing}
                className="flex-1 gap-2"
                size="lg"
              >
                {isPurchasing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5" />
                    Buy for {formatPrice(paidContent.price, paidContent.currency)}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
