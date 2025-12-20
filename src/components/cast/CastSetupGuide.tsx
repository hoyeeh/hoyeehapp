import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cast, Tv, Airplay, HelpCircle, CheckCircle2, Wifi, Chrome, Apple, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface CastSetupGuideProps {
  trigger?: React.ReactNode;
  defaultTab?: "chromecast" | "dlna" | "airplay";
}

const steps = {
  chromecast: [
    {
      title: "Use Chrome or Edge browser",
      description: "Chromecast requires a Chromium-based browser (Google Chrome, Microsoft Edge, or Brave).",
      icon: Chrome,
    },
    {
      title: "Connect to the same WiFi",
      description: "Make sure your computer/phone and Chromecast device are on the same WiFi network.",
      icon: Wifi,
    },
    {
      title: "Look for the Cast icon",
      description: "When a Chromecast is detected, the Cast option in the video player will become active.",
      icon: Cast,
    },
    {
      title: "Select your device",
      description: "Click the Cast button and choose your Chromecast device from the dropdown menu.",
      icon: CheckCircle2,
    },
  ],
  dlna: [
    {
      title: "Enable DLNA on your TV",
      description: "Most smart TVs have DLNA/UPnP built-in. Check your TV's network settings to enable it.",
      icon: Tv,
    },
    {
      title: "Connect to the same network",
      description: "Ensure your device and TV are connected to the same WiFi or wired network.",
      icon: Wifi,
    },
    {
      title: "Scan for devices",
      description: "Click 'DLNA/UPnP TV' in the cast menu to scan for available devices on your network.",
      icon: Monitor,
    },
    {
      title: "Select and cast",
      description: "Choose your TV from the list and the video will start playing on your big screen.",
      icon: CheckCircle2,
    },
  ],
  airplay: [
    {
      title: "Use Safari browser",
      description: "AirPlay only works in Safari on Mac or iOS devices. Other browsers don't support it.",
      icon: Apple,
    },
    {
      title: "Connect to the same WiFi",
      description: "Your Apple device and AirPlay receiver (Apple TV, AirPlay TV) must be on the same network.",
      icon: Wifi,
    },
    {
      title: "Click the AirPlay button",
      description: "In the cast menu, tap on AirPlay to see available devices.",
      icon: Airplay,
    },
    {
      title: "Choose your device",
      description: "Select your Apple TV or AirPlay-compatible TV from the picker to start streaming.",
      icon: CheckCircle2,
    },
  ],
};

export function CastSetupGuide({ trigger, defaultTab = "chromecast" }: CastSetupGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-4 w-4" />
            Setup Guide
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cast className="h-5 w-5 text-brand" />
            Cast Setup Guide
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chromecast" className="flex items-center gap-1.5">
              <Cast className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chromecast</span>
            </TabsTrigger>
            <TabsTrigger value="dlna" className="flex items-center gap-1.5">
              <Tv className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">DLNA</span>
            </TabsTrigger>
            <TabsTrigger value="airplay" className="flex items-center gap-1.5">
              <Airplay className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AirPlay</span>
            </TabsTrigger>
          </TabsList>

          {Object.entries(steps).map(([key, stepList]) => (
            <TabsContent key={key} value={key} className="mt-4 space-y-4">
              <div className="space-y-3">
                {stepList.map((step, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg",
                      "bg-muted/50 border border-border/50"
                    )}
                  >
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-brand/10 text-brand">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Step {index + 1}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm">{step.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-brand/5 border border-brand/20">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong>{" "}
                  {key === "chromecast" && "If your device doesn't appear, try refreshing the page or restarting your Chromecast."}
                  {key === "dlna" && "Some TVs may need the DLNA/Media Renderer feature enabled in network settings."}
                  {key === "airplay" && "Make sure AirPlay is enabled on your Apple TV in Settings → AirPlay."}
                </p>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
