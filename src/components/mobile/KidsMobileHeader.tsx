import { useState } from "react";
import { Baby, Lock, BarChart3 } from "lucide-react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useKidsSounds } from "@/hooks/useKidsSounds";
import { useHaptics } from "@/hooks/useHaptics";
import { KidsMobileParentalDashboard } from "./KidsMobileParentalDashboard";

export const KidsMobileHeader = () => {
  const { currentProfile, setCurrentProfile } = useProfileContext();
  const navigate = useNavigate();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<"exit" | "dashboard" | null>(null);
  
  const { playClickSound, playSuccessSound } = useKidsSounds();
  const { lightTap, mediumTap, successFeedback, errorFeedback } = useHaptics();

  const handleExitKids = () => {
    playClickSound();
    lightTap();
    setPendingAction("exit");
    setShowPinDialog(true);
  };

  const handleOpenDashboard = () => {
    playClickSound();
    lightTap();
    setPendingAction("dashboard");
    setShowPinDialog(true);
  };

  const verifyPin = async () => {
    if (pin.length !== 4) return;
    
    setIsVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("verify_parental_pin", {
        user_uuid: user.id,
        input_pin: pin,
      });

      if (error) throw error;

      if (data) {
        playSuccessSound();
        successFeedback();
        setShowPinDialog(false);
        setPin("");
        
        if (pendingAction === "exit") {
          localStorage.removeItem("hoyeeh_current_profile");
          setCurrentProfile(null as any);
          navigate("/");
          toast.success("Exited Kids mode");
        } else if (pendingAction === "dashboard") {
          setShowDashboard(true);
        }
      } else {
        errorFeedback();
        toast.error("Incorrect PIN");
        setPin("");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      errorFeedback();
      toast.error("Failed to verify PIN");
      setPin("");
    } finally {
      setIsVerifying(false);
      setPendingAction(null);
    }
  };

  const handlePinComplete = (value: string) => {
    setPin(value);
    if (value.length === 4) {
      mediumTap();
      verifyPin();
    }
  };

  if (showDashboard) {
    return <KidsMobileParentalDashboard onBack={() => setShowDashboard(false)} />;
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe">
        <div className="bg-gradient-to-b from-slate-900/98 via-slate-900/90 to-transparent backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Baby className="h-5 w-5 text-white stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  Kids
                </h1>
                {currentProfile?.name && (
                  <p className="text-xs text-white/60 -mt-0.5">
                    Hi, {currentProfile.name}
                  </p>
                )}
              </div>
            </motion.div>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleOpenDashboard}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 transition-colors hover:bg-white/10"
              >
                <BarChart3 className="h-5 w-5 stroke-[1.5]" />
              </motion.button>
              
              <motion.button
                onClick={handleExitKids}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium transition-colors hover:bg-white/10"
              >
                <Lock className="h-4 w-4 stroke-[1.5]" />
                <span>Exit</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-white max-w-xs mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold">
              {pendingAction === "dashboard" ? "Parental Access" : "Enter Parent PIN"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              {pendingAction === "dashboard" ? (
                <BarChart3 className="h-8 w-8 text-white" />
              ) : (
                <Lock className="h-8 w-8 text-white" />
              )}
            </div>
            <p className="text-sm text-white/60 text-center">
              {pendingAction === "dashboard" 
                ? "Enter your PIN to view activity dashboard"
                : "Enter your 4-digit parental PIN to exit Kids mode"}
            </p>
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={handlePinComplete}
              disabled={isVerifying}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="w-12 h-14 text-xl bg-white/5 border-white/20 text-white rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button
              onClick={verifyPin}
              disabled={pin.length !== 4 || isVerifying}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl py-3"
            >
              {isVerifying ? "Verifying..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
