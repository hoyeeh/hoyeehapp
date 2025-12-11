import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const mobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
    
    setIsIOS(ios);
    setIsMobile(mobile);

    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isInWebAppiOS = (navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      setIsInstalled(true);
      return;
    }

    // Check if banner was dismissed recently
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < dayInMs) {
        return; // Don't show banner if dismissed within last 24 hours
      }
    }

    // Listen for install prompt (Android/Desktop Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (mobile) {
        setShowBanner(true);
      }
    };

    // For iOS, show banner after a short delay
    if (ios && mobile && !isStandalone && !isInWebAppiOS) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowBanner(false);
    }
    
    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  return {
    isInstalled,
    isIOS,
    isMobile,
    showBanner,
    canInstall: !!deferredPrompt,
    promptInstall,
    dismissBanner,
  };
}
