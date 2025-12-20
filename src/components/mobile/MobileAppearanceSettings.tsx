import { useState } from "react";
import { ArrowLeft, Check, Moon, Sun, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { useTheme } from "next-themes";
import { toast } from "sonner";

interface MobileAppearanceSettingsProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  { id: "dark", label: "Dark", description: "Dark theme for low-light environments", icon: Moon },
  { id: "light", label: "Light", description: "Light theme for bright environments", icon: Sun },
  { id: "system", label: "System", description: "Match your device settings", icon: Monitor },
];

export function MobileAppearanceSettings({ open, onClose }: MobileAppearanceSettingsProps) {
  const { lightTap, selectionTap } = useHaptics();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: string) => {
    selectionTap();
    setTheme(newTheme);
    toast.success(`Theme set to ${THEME_OPTIONS.find(t => t.id === newTheme)?.label}`);
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
            <h2 className="text-lg font-semibold text-foreground">App Appearance</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {/* Theme Section */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Theme
              </h3>
              <div className="space-y-2">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleThemeChange(option.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all active:scale-[0.98]",
                      theme === option.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/20 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      theme === option.id ? "bg-primary/20" : "bg-muted/50"
                    )}>
                      <option.icon className={cn(
                        "w-5 h-5",
                        theme === option.id ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    {theme === option.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
