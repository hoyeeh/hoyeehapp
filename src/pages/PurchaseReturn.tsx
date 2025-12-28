import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVerifyPurchase } from "@/hooks/usePaidContent";
import { CheckCircle, XCircle, Loader2, Play, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export default function PurchaseReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const verifyPurchase = useVerifyPurchase();

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');
  const [showConfetti, setShowConfetti] = useState(false);

  const txRef = searchParams.get('tx_ref');
  const contentId = searchParams.get('content_id');
  const paymentStatus = searchParams.get('status');

  useEffect(() => {
    const verify = async () => {
      // Check if payment was cancelled
      if (paymentStatus === 'cancelled') {
        setStatus('cancelled');
        return;
      }

      // If we have a tx_ref, verify the payment
      if (txRef) {
        try {
          await verifyPurchase.mutateAsync(txRef);
          setStatus('success');
          setShowConfetti(true);
          
          // Invalidate purchase queries to update UI everywhere
          queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
          queryClient.invalidateQueries({ queryKey: ['has-purchased'] });
          queryClient.invalidateQueries({ queryKey: ['paid-content'] });
          
          // Auto-navigate after delay
          setTimeout(() => {
            if (contentId) {
              navigate(`/content/${contentId}`, { replace: true });
            } else {
              navigate('/creator-store', { replace: true });
            }
          }, 3000);
        } catch (error) {
          console.error('Verification failed:', error);
          setStatus('failed');
        }
      } else {
        // No tx_ref, check if cancelled
        if (paymentStatus === 'failed') {
          setStatus('failed');
        } else {
          setStatus('cancelled');
        }
      }
    };

    verify();
  }, [txRef, paymentStatus, contentId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {status === 'verifying' && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-6"
          >
            <div className="relative">
              <Loader2 className="h-20 w-20 animate-spin text-primary mx-auto" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Verifying Payment...</h1>
              <p className="text-muted-foreground">Please wait while we confirm your purchase</p>
            </div>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-6"
          >
            {/* Confetti effect */}
            {showConfetti && (
              <motion.div 
                className="absolute inset-0 pointer-events-none overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 5],
                      left: `${Math.random() * 100}%`,
                    }}
                    initial={{ y: -20, opacity: 1 }}
                    animate={{
                      y: window.innerHeight + 20,
                      opacity: 0,
                      rotate: Math.random() * 360,
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      delay: Math.random() * 0.5,
                      ease: 'linear',
                    }}
                  />
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="relative"
            >
              <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <h1 className="text-2xl font-bold text-green-500">Purchase Successful!</h1>
              <p className="text-muted-foreground">Your content is now unlocked</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3 max-w-xs mx-auto"
            >
              {contentId ? (
                <Button 
                  onClick={() => navigate(`/content/${contentId}`, { replace: true })} 
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Play className="h-5 w-5" />
                  Watch Now
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate('/creator-store', { replace: true })} 
                  className="gap-2"
                  size="lg"
                >
                  <Home className="h-5 w-5" />
                  Continue Browsing
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Redirecting automatically...</p>
            </motion.div>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-red-500">Payment Failed</h1>
              <p className="text-muted-foreground">We couldn't verify your payment. Please try again.</p>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button 
                onClick={() => navigate('/creator-store', { replace: true })} 
                size="lg"
              >
                Try Again
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate('/', { replace: true })}
              >
                Go Home
              </Button>
            </div>
          </motion.div>
        )}

        {status === 'cancelled' && (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
              <XCircle className="h-16 w-16 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-amber-500">Payment Cancelled</h1>
              <p className="text-muted-foreground">You cancelled the payment. No charges were made.</p>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button 
                onClick={() => navigate('/creator-store', { replace: true })} 
                size="lg"
              >
                Browse Content
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate('/', { replace: true })}
              >
                Go Home
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
