import { useState, useEffect } from "react";
import { ArrowLeft, Check, Globe } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
];

interface MobileLanguageSettingsProps {
  onClose: () => void;
}

export function MobileLanguageSettings({ onClose }: MobileLanguageSettingsProps) {
  const { lightTap, successFeedback, selectionTap } = useHaptics();
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("hoyeeh_language");
    if (saved) {
      setSelectedLanguage(saved);
    }
  }, []);

  const handleBack = () => {
    lightTap();
    onClose();
  };

  const handleSelectLanguage = (code: string) => {
    selectionTap();
    setSelectedLanguage(code);
    localStorage.setItem("hoyeeh_language", code);
    successFeedback();
    
    const language = LANGUAGES.find(l => l.code === code);
    toast.success(`Language changed to ${language?.name}`);
    
    // Note: Full i18n implementation would require a translation library
    // This stores the preference for future implementation
  };

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
          <h1 className="text-lg font-semibold">App Language</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pb-8 px-4 overflow-y-auto h-screen" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 20px))' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-muted/20 rounded-2xl mb-6"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">Display Language</p>
            <p className="text-xs text-muted-foreground">Choose your preferred language</p>
          </div>
        </motion.div>

        <div className="space-y-2">
          {LANGUAGES.map((language, index) => (
            <motion.button
              key={language.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleSelectLanguage(language.code)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-[0.98]",
                selectedLanguage === language.code
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted/20 border-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{language.flag}</span>
                <div className="text-left">
                  <p className="font-medium">{language.name}</p>
                  <p className="text-sm text-muted-foreground">{language.nativeName}</p>
                </div>
              </div>
              {selectedLanguage === language.code && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 px-4">
          Some content may not be available in all languages. Subtitles can be changed during playback.
        </p>
      </main>
    </motion.div>
  );
}
