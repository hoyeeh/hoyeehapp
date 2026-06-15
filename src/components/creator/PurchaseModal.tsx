import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHasPurchasedContent } from "@/hooks/useCreator";
import { useInitializePurchase, useVerifyPurchase } from "@/hooks/usePaidContent";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, Play, ShoppingBag, Loader2, CreditCard, Smartphone, Clock, User, X, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePaidContentAnalytics } from "@/hooks/usePaidContentAnalytics";
import { useNewPlayerForFree } from "@/hooks/useNewPlayer";
import { VideoJSPlayer, type VideoJSPlayerHandle } from "@/components/VideoJSPlayer";

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  paidContent: any;
  onPurchased?: (contentId: string) => void;
}

type ModalState = 'purchase' | 'waiting' | 'verifying' | 'success';

export function PurchaseModal({ open, onClose, paidContent, onPurchased }: PurchaseModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const content = paidContent?.content;
  const creator = paidContent?.creator_profiles;
  
  const { data: hasPurchased, isLoading: checkingPurchase, refetch: refetchPurchase } = useHasPurchasedContent(content?.id);
  const initializePurchase = useInitializePurchase();
  const verifyPurchase = useVerifyPurchase();
  const analytics = usePaidContentAnalytics();
  
  // Track modal open
  const [modalState, setModalState] = useState<ModalState>('purchase');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [currentTxRef, setCurrentTxRef] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getPreviewStartTime = (duration: number | null | undefined): number => {
    if (!duration) return 0;
    const durationInMinutes = duration / 60;
    if (durationInMinutes >= 10) {
      return 10 * 60;
    } else if (durationInMinutes >= 1) {
      return 60;
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

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setIsPreviewPlaying(false);
      setModalState('purchase');
      setCurrentTxRef(null);
      setShowConfetti(false);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    }
  }, [open]);

  // Check if purchase was completed (e.g., via return redirect in same tab)
  useEffect(() => {
    if (open && hasPurchased && modalState === 'purchase') {
      // Purchase already completed
    }
  }, [open, hasPurchased, modalState]);

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
      
      if (result.paymentLink && result.txRef) {
        setCurrentTxRef(result.txRef);
        // Open payment link in new tab
        window.open(result.paymentLink, '_blank');
        // Switch to waiting state
        setModalState('waiting');
        toast.info("Complete your payment in the new tab, then return here");
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!currentTxRef) return;
    
    setIsVerifying(true);
    setModalState('verifying');
    
    try {
      await verifyPurchase.mutateAsync(currentTxRef);
      
      // Success! Show animation
      setModalState('success');
      setShowConfetti(true);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['has-purchased'] });
      queryClient.invalidateQueries({ queryKey: ['paid-content'] });
      await refetchPurchase();
      
      // Notify parent
      if (onPurchased) {
        onPurchased(content.id);
      }
      
      // Auto-close after delay
      setTimeout(() => {
        onClose();
        navigate(`/content/${content.id}`);
      }, 2500);
      
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error("Payment not yet confirmed. Please try again in a moment.");
      setModalState('waiting');
    } finally {
      setIsVerifying(false);
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
        <AnimatePresence mode="wait">
          {/* Success State */}
          {modalState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-8 text-center space-y-6 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden"
            >
              {/* Confetti */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(30)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 5],
                        left: `${Math.random() * 100}%`,
                      }}
                      initial={{ y: -10, opacity: 1 }}
                      animate={{
                        y: 400,
                        opacity: 0,
                        rotate: Math.random() * 360,
                      }}
                      transition={{
                        duration: 1.5 + Math.random(),
                        delay: Math.random() * 0.3,
                        ease: 'linear',
                      }}
                    />
                  ))}
                </div>
              )}

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-xl font-bold text-green-500">Purchase Successful!</h2>
                <p className="text-muted-foreground mt-1">Redirecting to your content...</p>
              </motion.div>
            </motion.div>
          )}

          {/* Verifying State */}
          {modalState === 'verifying' && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center space-y-6 min-h-[400px] flex flex-col items-center justify-center"
            >
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div>
                <h2 className="text-xl font-bold">Verifying Payment...</h2>
                <p className="text-muted-foreground mt-1">Please wait while we confirm your purchase</p>
              </div>
            </motion.div>
          )}

          {/* Waiting State */}
          {modalState === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-500">Complete Payment in New Tab</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    A payment page has opened in a new tab. Complete your payment there, then return here and click "Verify Payment".
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                <img
                  src={content.thumbnail_url || '/placeholder.svg'}
                  alt={content.title}
                  className="w-20 h-12 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{content.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(paidContent.price, paidContent.currency)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleVerifyPayment}
                  disabled={isVerifying}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isVerifying ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                  Verify Payment
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setModalState('purchase')}
                  className="w-full"
                >
                  Cancel & Go Back
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Payment not working? Try opening the payment link again or contact support.
              </p>
            </motion.div>
          )}

          {/* Purchase State (default) */}
          {(modalState === 'purchase' && !hasPurchased) && (
            <motion.div
              key="purchase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Status Header Banner */}
              {checkingPurchase ? (
                <div className="bg-secondary/50 px-4 py-3 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Checking purchase status...</span>
                </div>
              ) : (
                <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 flex items-center justify-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">Purchase Required</span>
                </div>
              )}

              {/* Preview Video or Image */}
              <div className="relative aspect-video">
                {isPreviewPlaying && content.video_url ? (
                  <div className="relative w-full h-full bg-black">
                    <PreviewPlayer
                      videoRef={videoRef}
                      src={content.video_url}
                      isPremium={Boolean(content.is_premium || content.requires_drm)}
                      isPaid={Number(paidContent?.price ?? 0) > 0}
                      startTime={getPreviewStartTime(content.duration)}
                      poster={content.thumbnail_url || content.backdrop_url}
                      title={content.title}
                      onEnded={handlePreviewEnd}
                      onError={() => {
                        toast.error("Error playing preview");
                        setIsPreviewPlaying(false);
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-4 right-4 z-40 bg-background/80"
                      onClick={handlePreviewEnd}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-4 left-4 z-40 bg-background/80 px-3 py-1 rounded-full text-sm">
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
                    {!checkingPurchase && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2 font-bold">
                          {formatPrice(paidContent.price, paidContent.currency)}
                        </Badge>
                      </div>
                    )}

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
                {!checkingPurchase && (
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
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handlePurchase} 
                      disabled={isPurchasing}
                      className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
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
            </motion.div>
          )}

          {/* Already Purchased State */}
          {(modalState === 'purchase' && hasPurchased) && (
            <motion.div
              key="purchased"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-green-500/20 border-b border-green-500/30 px-4 py-3 flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-semibold text-green-500">Paid Access</span>
              </div>

              <div className="relative aspect-video">
                <img
                  src={content.thumbnail_url || '/placeholder.svg'}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-500 text-white text-lg px-4 py-2 font-bold gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Owned
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{content.content_type === 'series' ? 'TV Series' : 'Movie'}</Badge>
                    {content.genre && <Badge variant="secondary">{content.genre}</Badge>}
                  </div>
                  <h2 className="text-2xl font-bold">{content.title}</h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-500 justify-center p-3 bg-green-500/10 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">You have Paid Access to this content</span>
                  </div>
                  <Button onClick={handleWatch} className="w-full gap-2 bg-green-600 hover:bg-green-700" size="lg">
                    <Play className="h-5 w-5" />
                    Watch Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Phase 3 — Creator preview surface.
 *
 * Strict guard order (highest → lowest priority):
 *  1. Premium / Widevine-flagged content  → legacy <video> (DRM/EME path untouched).
 *  2. Paid creator content (price > 0)    → legacy <video> (free-creator-only rule).
 *  3. New-player flag (?player=vjs) OFF   → legacy <video>.
 *  4. Otherwise (free creator MP4, flag on) → VideoJSPlayer with crossOrigin="anonymous"
 *     so DigitalOcean signed URLs work, and the upstream caller's resolved `src`
 *     is passed through verbatim — VideoJSPlayer itself stays dumb (no fetching).
 *
 * The signed-URL error overlay ("Session expired…") is rendered for both code paths
 * on `error` events surfaced by the underlying player.
 */
function PreviewPlayer({
  videoRef,
  src,
  isPremium,
  isPaid,
  startTime,
  poster,
  title,
  onEnded,
  onError,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  isPremium: boolean;
  isPaid: boolean;
  startTime: number;
  poster?: string;
  title?: string;
  onEnded: () => void;
  onError: () => void;
}) {
  // Phase 4: VJS is default for free creator content. Strict guards remain.
  const newPlayerEnabled = useNewPlayerForFree();
  const useVjs = newPlayerEnabled && !isPremium && !isPaid;
  const vjsRef = useRef<VideoJSPlayerHandle | null>(null);
  const [expired, setExpired] = useState(false);

  // Bridge the VJS-managed <video> element back to the parent's videoRef so the
  // existing 10-second preview timer/seek logic keeps working unchanged.
  const handleVideoElement = (el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
  };

  if (!useVjs) {
    return (
      <video
        ref={videoRef}
        src={src}
        crossOrigin="anonymous"
        poster={poster}
        title={title}
        className="w-full h-full object-contain"
        onEnded={onEnded}
        onError={onError}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      <VideoJSPlayer
        ref={vjsRef}
        className="w-full h-full"
        onVideoElement={handleVideoElement}
        poster={poster}
        title={title}
        options={{
          autoplay: false,
          controls: false,
          muted: false,
          preload: "auto",
          sources: [{ src, type: "video/mp4" }],
        }}
        onReady={(player) => {
          player.currentTime(startTime);
          player.play()?.catch(() => {});
          player.on("ended", onEnded);
          player.on("error", () => {
            const err = player.error?.();
            // 403/404 from expired signed URL surfaces as MEDIA_ERR_NETWORK (2)
            // or MEDIA_ERR_SRC_NOT_SUPPORTED (4). Treat both as session expiry.
            if (err && (err.code === 2 || err.code === 4)) {
              setExpired(true);
            } else {
              onError();
            }
          });
        }}
      />
      {expired && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/90 text-center p-6">
          <p className="text-foreground font-medium">Session expired</p>
          <p className="text-muted-foreground text-sm mt-1">
            Your secure preview link has expired. Please refresh to continue.
          </p>
        </div>
      )}
    </div>
  );
}
