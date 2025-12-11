import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import pwaIcon from "@/assets/pwa-icon.png";

export function PWAInstallBanner() {
  const { showBanner, isIOS, canInstall, promptInstall, dismissBanner } = usePWAInstall();

  if (!showBanner) return null;

  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (isIOS) {
      // For iOS, redirect to install page with instructions
      window.location.href = "/install";
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-md mx-auto">
        <div className="p-4">
          <button
            onClick={dismissBanner}
            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <img 
              src={pwaIcon} 
              alt="Hoyeeh" 
              className="w-14 h-14 rounded-xl shrink-0" 
            />
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">
                Install Hoyeeh App
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get the full experience with offline access & faster loading
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {isIOS ? (
              <Button 
                onClick={handleInstall}
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Share className="h-4 w-4 mr-1.5" />
                Tap Share
                <Plus className="h-4 w-4 ml-1" />
                Add to Home
              </Button>
            ) : canInstall ? (
              <Button 
                onClick={handleInstall}
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            ) : (
              <Button 
                onClick={() => window.location.href = "/install"}
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4 mr-2" />
                How to Install
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={dismissBanner}
            >
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
