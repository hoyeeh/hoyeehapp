import { useState, useEffect } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";

interface MobilePlaybackSettingsProps {
  open: boolean;
  onClose: () => void;
}

const QUALITY_OPTIONS = [
  { id: "auto", label: "Auto", description: "Best quality for your connection" },
  { id: "high", label: "High", description: "1080p - Best quality, uses more data" },
  { id: "medium", label: "Medium", description: "720p - Balanced quality and data" },
  { id: "low", label: "Low", description: "480p - Saves data, lower quality" },
];

export function MobilePlaybackSettings({ open, onClose }: MobilePlaybackSettingsProps) {
  const { lightTap, selectionTap } = useHaptics();
  const [quality, setQuality] = useState(() => {
    return localStorage.getItem("hoyeeh_playback_quality") || "auto";
  });
  const [dataSaver, setDataSaver] = useState(() => {
    return localStorage.getItem("hoyeeh_data_saver") === "true";
  });

  const handleQualityChange = (newQuality: string) => {
    selectionTap();
    setQuality(newQuality);
    localStorage.setItem("hoyeeh_playback_quality", newQuality);
    toast.success(`Video quality set to ${QUALITY_OPTIONS.find(q => q.id === newQuality)?.label}`);
  };

  const handleDataSaverToggle = () => {
    selectionTap();
    const newValue = !dataSaver;
    setDataSaver(newValue);
    localStorage.setItem("hoyeeh_data_saver", String(newValue));
    toast.success(newValue ? "Data saver enabled" : "Data saver disabled");
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="flex flex-col h-full pt-safe">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border/10">
            <button
              onClick={() => {
                lightTap();
                onClose();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">Playback Settings</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {/* Video Quality Section */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Video Quality
              </h3>
              <div className="space-y-2">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleQualityChange(option.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-[0.98]",
                      quality === option.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/20 border border-transparent"
                    )}
                  >
                    <div className="text-left">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    {quality === option.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Saver Section */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Data Usage
              </h3>
              <button
                onClick={handleDataSaverToggle}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-[0.98]",
                  dataSaver
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted/20 border border-transparent"
                )}
              >
                <div className="text-left">
                  <p className="font-medium text-foreground">Data Saver Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Reduce data usage by lowering video quality on mobile networks
                  </p>
                </div>
                <div className={cn(
                  "w-12 h-7 rounded-full p-1 transition-colors",
                  dataSaver ? "bg-primary" : "bg-muted"
                )}>
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white shadow transition-transform",
                    dataSaver ? "translate-x-5" : "translate-x-0"
                  )} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
