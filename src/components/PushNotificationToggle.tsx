import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Push Notifications</p>
          <p className="text-xs text-muted-foreground">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-brand" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label htmlFor="push-toggle" className="text-sm font-medium cursor-pointer">
            Push Notifications
          </Label>
          <p className="text-xs text-muted-foreground">
            {isSubscribed ? "Enabled - You'll receive alerts" : "Disabled - Enable to get updates"}
          </p>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Switch
          id="push-toggle"
          checked={isSubscribed}
          onCheckedChange={(checked) => {
            if (checked) {
              subscribe();
            } else {
              unsubscribe();
            }
          }}
        />
      )}
    </div>
  );
}
