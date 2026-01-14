import { useState, useEffect } from "react";
import { ArrowLeft, Shield, Lock, Eye, EyeOff, Check, Users, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const CONTENT_RATINGS = [
  { value: "G", label: "G", description: "General Audiences - All ages" },
  { value: "PG", label: "PG", description: "Parental Guidance Suggested" },
  { value: "PG-13", label: "PG-13", description: "Parents Strongly Cautioned" },
  { value: "R", label: "R", description: "Restricted - Under 17 requires adult" },
  { value: "NC-17", label: "NC-17", description: "Adults Only" },
];

interface MobileParentalControlsProps {
  onClose: () => void;
}

export function MobileParentalControls({ onClose }: MobileParentalControlsProps) {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { lightTap, successFeedback, selectionTap, warningFeedback } = useHaptics();

  const [enabled, setEnabled] = useState(false);
  const [ratingLimit, setRatingLimit] = useState("R");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");

  useEffect(() => {
    if (profile) {
      setEnabled((profile as any).parental_controls_enabled || false);
      setRatingLimit((profile as any).parental_rating_limit || "R");
    }
  }, [profile]);

  const handleBack = () => {
    lightTap();
    onClose();
  };

  const handleEnableToggle = (checked: boolean) => {
    selectionTap();
    if (checked) {
      const hasExistingPin = !!(profile as any)?.parental_pin;
      if (!hasExistingPin) {
        setShowPinSetup(true);
        setPinStep("enter");
        setPin("");
        setConfirmPin("");
      } else {
        setEnabled(true);
      }
    } else {
      setEnabled(false);
    }
  };

  const handlePinEntered = (value: string) => {
    if (pinStep === "enter") {
      setPin(value);
      if (value.length === 4) {
        setTimeout(() => {
          setPinStep("confirm");
        }, 300);
      }
    } else {
      setConfirmPin(value);
      if (value.length === 4) {
        if (value === pin) {
          successFeedback();
          setShowPinSetup(false);
          setEnabled(true);
          toast.success("PIN set successfully! Kids mode is now enabled.");
        } else {
          warningFeedback();
          toast.error("PINs don't match. Try again.");
          setPinStep("enter");
          setPin("");
          setConfirmPin("");
        }
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (enabled && !hasExistingPin && !pin) {
      toast.error("Please set a PIN to enable parental controls");
      return;
    }

    setIsSaving(true);
    lightTap();

    try {
      const updates: any = {
        parental_controls_enabled: enabled,
        parental_rating_limit: ratingLimit,
      };

      if (pin && pin.length === 4) {
        updates.parental_pin = pin;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      successFeedback();
      refetch();
      setPin("");
      setConfirmPin("");
      toast.success("Parental controls updated");
      onClose();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const hasExistingPin = !!(profile as any)?.parental_pin;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Parental Controls</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pb-8 px-4 overflow-y-auto h-screen" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 20px))' }}>
        {/* Enable Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Enable Parental Controls</p>
              <p className="text-xs text-muted-foreground">Restrict content by rating</p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleEnableToggle}
          />
        </motion.div>

        {enabled && (
          <>
            {/* Rating Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Maximum Rating
              </h3>
              <div className="space-y-2">
                {CONTENT_RATINGS.map((rating, index) => (
                  <motion.button
                    key={rating.value}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    onClick={() => {
                      selectionTap();
                      setRatingLimit(rating.value);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl transition-all",
                      ratingLimit === rating.value
                        ? "bg-primary/20 border-2 border-primary"
                        : "bg-muted/20 border-2 border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-12 h-8 flex items-center justify-center rounded font-bold text-sm",
                        ratingLimit === rating.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      )}>
                        {rating.label}
                      </span>
                      <span className="text-sm text-muted-foreground">{rating.description}</span>
                    </div>
                    {ratingLimit === rating.value && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 px-1">
                Content above this rating will require PIN to view
              </p>
            </motion.div>

            {/* PIN Setup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-muted/20 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium">{hasExistingPin ? "Change PIN" : "Set PIN"}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasExistingPin ? "Enter new PIN to change" : "4-6 digit PIN required"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={hasExistingPin ? "New PIN" : "Enter PIN"}
                    className="h-12 rounded-xl bg-muted/50 border-border/30 pr-12"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <Input
                  type={showPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Confirm PIN"
                  className="h-12 rounded-xl bg-muted/50 border-border/30"
                  maxLength={6}
                />
              </div>
            </motion.div>
          </>
        )}

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Button
            onClick={handleSave}
            disabled={isSaving || (enabled && !hasExistingPin && !pin)}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </motion.div>
      </main>

      {/* PIN Setup Modal */}
      <AnimatePresence>
        {showPinSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm mx-4 p-6 bg-card rounded-3xl border border-border/30 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-primary-foreground" />
                </div>
                
                <h2 className="text-xl font-bold mb-2">
                  {pinStep === "enter" ? "Create Kids PIN" : "Confirm Your PIN"}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {pinStep === "enter" 
                    ? "Enter a 4-digit PIN to protect Kids mode settings" 
                    : "Enter the same PIN again to confirm"
                  }
                </p>

                <div className="mb-6">
                  <InputOTP
                    maxLength={4}
                    value={pinStep === "enter" ? pin : confirmPin}
                    onChange={handlePinEntered}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-3">
                      <InputOTPSlot index={0} className="w-14 h-14 text-2xl rounded-xl border-2 border-primary/30 bg-muted/50" />
                      <InputOTPSlot index={1} className="w-14 h-14 text-2xl rounded-xl border-2 border-primary/30 bg-muted/50" />
                      <InputOTPSlot index={2} className="w-14 h-14 text-2xl rounded-xl border-2 border-primary/30 bg-muted/50" />
                      <InputOTPSlot index={3} className="w-14 h-14 text-2xl rounded-xl border-2 border-primary/30 bg-muted/50" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {/* Step indicator */}
                <div className="flex gap-2 mb-6">
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    pinStep === "enter" ? "bg-primary" : "bg-primary/30"
                  )} />
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    pinStep === "confirm" ? "bg-primary" : "bg-primary/30"
                  )} />
                </div>

                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={() => {
                      lightTap();
                      setShowPinSetup(false);
                      setPin("");
                      setConfirmPin("");
                    }}
                    className="flex-1 h-11 rounded-xl"
                  >
                    Cancel
                  </Button>
                  {pinStep === "confirm" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        lightTap();
                        setPinStep("enter");
                        setPin("");
                        setConfirmPin("");
                      }}
                      className="flex-1 h-11 rounded-xl"
                    >
                      Start Over
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span>This PIN is required to exit Kids mode</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
