import { useState } from "react";
import { Settings, ChevronLeft, Users } from "lucide-react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { KidsMobileParentalDashboard } from "./KidsMobileParentalDashboard";

export const KidsMobileHeader = () => {
  const { currentProfile, setCurrentProfile } = useProfileContext();
  const navigate = useNavigate();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState<"exit" | "dashboard" | null>(null);

  const handleAction = (action: "exit" | "dashboard") => {
    setPendingAction(action);
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
        toast.error("Incorrect PIN");
        setPin("");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      toast.error("Failed to verify PIN");
      setPin("");
    } finally {
      setIsVerifying(false);
      setPendingAction(null);
    }
  };

  if (showDashboard) {
    return <KidsMobileParentalDashboard onBack={() => setShowDashboard(false)} />;
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe">
        <div className="bg-[#0A0A0F]/95 backdrop-blur-2xl border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">K</span>
                </div>
              </div>
              <div>
                <h1 className="text-[17px] font-semibold text-white tracking-[-0.02em]">
                  Kids
                </h1>
                {currentProfile?.name && (
                  <p className="text-[13px] text-white/50 font-medium">
                    {currentProfile.name}
                  </p>
                )}
              </div>
            </motion.div>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => window.dispatchEvent(new CustomEvent('toggleWatchParty'))}
                whileTap={{ scale: 0.96 }}
                className="p-2.5 rounded-full bg-white/[0.08] text-white/90 transition-all hover:bg-white/[0.12] active:bg-white/[0.06]"
                aria-label="Watch Party"
              >
                <Users className="h-5 w-5" />
              </motion.button>
              <motion.button
                onClick={() => handleAction("exit")}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] text-white/90 text-[13px] font-semibold tracking-[-0.01em] transition-all hover:bg-white/[0.12] active:bg-white/[0.06]"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                Exit
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="bg-[#1C1C1E] border-white/[0.08] text-white max-w-[320px] mx-auto rounded-3xl p-6">
          <DialogHeader className="space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Settings className="h-7 w-7 text-white" strokeWidth={1.5} />
            </div>
            <DialogTitle className="text-center text-xl font-semibold tracking-[-0.02em]">
              Parent PIN
            </DialogTitle>
            <p className="text-center text-[15px] text-white/50 font-medium">
              Enter your 4-digit PIN to continue
            </p>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 pt-4">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(value) => {
                setPin(value);
                if (value.length === 4) setTimeout(verifyPin, 100);
              }}
              disabled={isVerifying}
            >
              <InputOTPGroup className="gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="w-14 h-14 text-xl font-semibold bg-white/[0.06] border-white/[0.08] text-white rounded-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            
            <Button
              onClick={verifyPin}
              disabled={pin.length !== 4 || isVerifying}
              className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-xl text-[15px]"
            >
              {isVerifying ? "Verifying..." : "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};