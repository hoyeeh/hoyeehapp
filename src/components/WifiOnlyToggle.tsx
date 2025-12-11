import { Wifi, WifiOff, Signal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

export const WifiOnlyToggle = () => {
  const { 
    isOnline, 
    isWifi, 
    connectionType, 
    wifiOnlyEnabled, 
    toggleWifiOnly 
  } = useNetworkStatus();

  return (
    <Card className="bg-secondary border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isWifi ? (
              <Wifi className="h-5 w-5 text-brand" />
            ) : (
              <Signal className="h-5 w-5 text-yellow-500" />
            )}
            <div>
              <Label htmlFor="wifi-only" className="font-medium cursor-pointer">
                Wi-Fi Only Downloads
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOnline ? (
                  isWifi ? (
                    <span className="text-green-500">Connected to Wi-Fi</span>
                  ) : (
                    <span className="text-yellow-500">Using mobile data</span>
                  )
                ) : (
                  <span className="text-destructive">Offline</span>
                )}
              </p>
            </div>
          </div>
          <Switch
            id="wifi-only"
            checked={wifiOnlyEnabled}
            onCheckedChange={toggleWifiOnly}
          />
        </div>
        
        {wifiOnlyEnabled && !isWifi && isOnline && (
          <div className="mt-3 p-2 bg-yellow-500/10 rounded-md">
            <p className="text-xs text-yellow-500 flex items-center gap-2">
              <WifiOff className="h-3 w-3" />
              Downloads paused until Wi-Fi is available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
