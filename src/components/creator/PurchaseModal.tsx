import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHasPurchasedContent } from "@/hooks/useCreator";
import { useInitializePurchase } from "@/hooks/usePaidContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, Play, ShoppingBag, Loader2, CreditCard, Smartphone, Clock, Star, User, X } from "lucide-react";
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
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Calculate preview start time: 10 mins for long videos, 1 min for short videos
  const getPreviewStartTime = (duration: number | null | undefined): number => {
    if (!duration) return 0;
    const durationInMinutes = duration / 60;
    // For videos >= 10 minutes, start at 10 minutes mark
    // For shorter videos, start at 1 minute mark
    if (durationInMinutes >= 10) {
      return 10 * 60; // 10 minutes in seconds
    } else if (durationInMinutes >= 1) {
      return 60; // 1 minute in seconds
    }
    return 0;
  };

  const handlePreviewPlay = () => {
    if (!content?.video_url) {
      toast.error("No video available for preview");
      return;
    }
    setIsPreviewPlaying(true);
  };

  const handlePreviewEnd = () => {
    setIsPreviewPlaying(false);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
  };

  useEffect(() => {
    if (isPreviewPlaying && videoRef.current && content?.video_url) {
      const video = videoRef.current;
      const startTime = getPreviewStartTime(content.duration);
      
      video.currentTime = startTime;
      video.play().catch(console.error);
      
      // Stop after 10 seconds
      previewTimeoutRef.current = setTimeout(() => {
        video.pause();
        setIsPreviewPlaying(false);
        toast.info("Preview ended. Purchase to watch the full content!");
      }, 10000);
    }

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [isPreviewPlaying, content?.video_url, content?.duration]);

  // Reset preview when modal closes
  useEffect(() => {
    if (!open) {
      setIsPreviewPlaying(false);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    }
  }, [open]);

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Please sign in to purchase");
      navigate('/auth');
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await initializePurchase.mutateAsync({
        contentId: content.id,
        paymentMethod,
      });
      if (result.paymentLink) {
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
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Preview Video or Image */}
        <div className="relative aspect-video">
          {isPreviewPlaying && content.video_url ? (
            <div className="relative w-full h-full bg-black">
              <video
                ref={videoRef}
                src={content.video_url}
                className="w-full h-full object-contain"
                onEnded={handlePreviewEnd}
                onError={() => {
                  toast.error("Error playing preview");
                  setIsPreviewPlaying(false);
                }}
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 bg-background/80"
                onClick={handlePreviewEnd}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-4 left-4 bg-background/80 px-3 py-1 rounded-full text-sm">
                Preview: 10 seconds
              </div>
            </div>
          ) : (
            <>
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
                  onClick={handlePreviewPlay}
                >
                  <Play className="h-5 w-5" />
                  Preview
                </Button>
              )}
            </>
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

          {/* Payment Method Selection */}
          {!hasPurchased && !checkingPurchase && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Select Payment Method</p>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as 'mobile_money' | 'card')}
                className="grid grid-cols-2 gap-3"
              >
                <div className="relative">
                  <RadioGroupItem
                    value="mobile_money"
                    id="mobile_money"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="mobile_money"
                    className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-secondary/50"
                  >
                    <Smartphone className="h-6 w-6" />
                    <span className="font-medium">Mobile Money</span>
                    <span className="text-xs text-muted-foreground">MTN, Orange, etc.</span>
                  </Label>
                </div>
                <div className="relative">
                  <RadioGroupItem
                    value="card"
                    id="card"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="card"
                    className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-secondary/50"
                  >
                    <CreditCard className="h-6 w-6" />
                    <span className="font-medium">Card Payment</span>
                    <span className="text-xs text-muted-foreground">Visa, Mastercard</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

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