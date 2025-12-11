import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Apple, Chrome, Share, Plus, MoreVertical } from "lucide-react";
import pwaIcon from "@/assets/pwa-icon.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deviceOS, setDeviceOS] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");

  useEffect(() => {
    // Detect device OS
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceOS("ios");
    } else if (/android/.test(userAgent)) {
      setDeviceOS("android");
    } else if (/windows|macintosh|linux/.test(userAgent)) {
      setDeviceOS("desktop");
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const IOSInstructions = () => (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Apple className="h-6 w-6" />
          Install on iPhone/iPad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <div>
              <p className="font-medium text-foreground">Open in Safari</p>
              <p className="text-sm text-muted-foreground">Make sure you're using Safari browser</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">Tap the Share button</p>
              <Share className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">Scroll down and tap "Add to Home Screen"</p>
              <Plus className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</div>
            <div>
              <p className="font-medium text-foreground">Tap "Add" to confirm</p>
              <p className="text-sm text-muted-foreground">The app icon will appear on your home screen</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AndroidInstructions = () => (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Smartphone className="h-6 w-6" />
          Install on Android
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deferredPrompt ? (
          <Button 
            onClick={handleInstallClick} 
            size="lg" 
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Download className="mr-2 h-5 w-5" />
            Install Hoyeeh App
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Tap the menu button</p>
                <MoreVertical className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div>
                <p className="font-medium text-foreground">Tap "Install app" or "Add to Home Screen"</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</div>
              <div>
                <p className="font-medium text-foreground">Tap "Install" to confirm</p>
                <p className="text-sm text-muted-foreground">The app will be added to your home screen</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const DesktopInstructions = () => (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Monitor className="h-6 w-6" />
          Install on Desktop
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deferredPrompt ? (
          <Button 
            onClick={handleInstallClick} 
            size="lg" 
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Download className="mr-2 h-5 w-5" />
            Install Hoyeeh App
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Look for the install icon</p>
                <Chrome className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div>
                <p className="font-medium text-foreground">Click the install icon in the address bar</p>
                <p className="text-sm text-muted-foreground">Or click the menu (⋮) → "Install Hoyeeh"</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</div>
              <div>
                <p className="font-medium text-foreground">Click "Install" to confirm</p>
                <p className="text-sm text-muted-foreground">The app will open in its own window</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <img src={pwaIcon} alt="Hoyeeh" className="w-24 h-24 mx-auto rounded-2xl" />
            <h1 className="text-2xl font-bold text-foreground">App Installed!</h1>
            <p className="text-muted-foreground">
              Hoyeeh is installed on your device. You can now access it from your home screen.
            </p>
            <Button onClick={() => window.location.href = "/"} className="mt-4">
              Open App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/20 to-background py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <img src={pwaIcon} alt="Hoyeeh" className="w-28 h-28 mx-auto rounded-3xl shadow-lg" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Install Hoyeeh
          </h1>
          <p className="text-lg text-muted-foreground">
            Get the full app experience with offline access, faster loading, and home screen access.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center p-4 bg-card rounded-lg border border-border">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Offline Access</p>
          </div>
          <div className="text-center p-4 bg-card rounded-lg border border-border">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Home Screen</p>
          </div>
          <div className="text-center p-4 bg-card rounded-lg border border-border">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
              <Chrome className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Fast Loading</p>
          </div>
        </div>

        {/* Device-specific instructions */}
        <div className="space-y-4">
          {deviceOS === "ios" && <IOSInstructions />}
          {deviceOS === "android" && <AndroidInstructions />}
          {deviceOS === "desktop" && <DesktopInstructions />}
          
          {/* Show all instructions for unknown devices */}
          {deviceOS === "unknown" && (
            <>
              <IOSInstructions />
              <AndroidInstructions />
              <DesktopInstructions />
            </>
          )}
        </div>

        {/* Back to app link */}
        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Continue to Website
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
