import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Clock, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ParentalSetupStatus {
  hasPinSet: boolean;
  hasTimeLimitSet: boolean;
}

export const KidsParentalSetupNotice = () => {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const navigate = useNavigate();
  const [setupStatus, setSetupStatus] = useState<ParentalSetupStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!user || !currentProfile?.is_kids) {
        setIsLoading(false);
        return;
      }

      // Check if already dismissed for this session
      const dismissedKey = `kids_setup_dismissed_${currentProfile.id}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setIsDismissed(true);
        setIsLoading(false);
        return;
      }

      try {
        // Check if parental PIN is set in profiles table
        const { data: profileData } = await supabase
          .from("profiles")
          .select("parental_pin")
          .eq("id", user.id)
          .maybeSingle();

        // Check if time limit is set for the kids profile
        const { data: kidsProfile } = await supabase
          .from("user_profiles")
          .select("daily_time_limit_minutes")
          .eq("id", currentProfile.id)
          .maybeSingle();

        setSetupStatus({
          hasPinSet: !!profileData?.parental_pin,
          hasTimeLimitSet: !!kidsProfile?.daily_time_limit_minutes && kidsProfile.daily_time_limit_minutes > 0,
        });
      } catch (error) {
        console.error("Error checking parental setup:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupStatus();
  }, [user, currentProfile]);

  const handleDismiss = () => {
    if (currentProfile) {
      sessionStorage.setItem(`kids_setup_dismissed_${currentProfile.id}`, "true");
    }
    setIsDismissed(true);
  };

  const handleSetup = () => {
    navigate("/parental");
  };

  // Don't show if loading, dismissed, not a kids profile, or everything is set up
  if (isLoading || isDismissed || !currentProfile?.is_kids || !setupStatus) {
    return null;
  }

  // Don't show if both PIN and time limit are set
  if (setupStatus.hasPinSet && setupStatus.hasTimeLimitSet) {
    return null;
  }

  const missingItems = [];
  if (!setupStatus.hasPinSet) missingItems.push("Parental PIN");
  if (!setupStatus.hasTimeLimitSet) missingItems.push("Daily Time Limit");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-3 md:mx-6 mb-4"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border border-amber-500/30 p-4 md:p-5">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>

          <div className="relative flex flex-col md:flex-row md:items-center gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Shield className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] md:text-base font-semibold text-white mb-1 tracking-[-0.01em]">
                Set Up Parental Controls
              </h3>
              <p className="text-[13px] md:text-[14px] text-white/60 font-medium leading-relaxed">
                Keep your child safe! Set up {missingItems.join(" and ")} to manage screen time.
              </p>

              {/* Missing items badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {!setupStatus.hasPinSet && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[12px] text-white/80 font-medium">
                    <Shield className="h-3.5 w-3.5" />
                    <span>PIN not set</span>
                  </div>
                )}
                {!setupStatus.hasTimeLimitSet && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[12px] text-white/80 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    <span>No time limit</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action button */}
            <div className="flex-shrink-0">
              <Button
                onClick={handleSetup}
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-lg shadow-amber-500/30 rounded-xl px-4 py-2 h-auto text-[13px] font-semibold"
              >
                <Settings className="h-4 w-4 mr-1.5" />
                Set Up Now
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
