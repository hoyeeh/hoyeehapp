import { useSeriesNotifications } from "@/hooks/useSeriesNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SeriesNotificationButtonProps {
  contentId: string;
  contentType: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export const SeriesNotificationButton = ({
  contentId,
  contentType,
  variant = "outline",
  size = "default"
}: SeriesNotificationButtonProps) => {
  const { user } = useAuth();
  const { isSubscribed, isToggling, toggleSubscription } = useSeriesNotifications(contentId);

  // Only show for series
  if (contentType !== 'series') return null;

  const handleClick = () => {
    if (!user) {
      toast.error("Please sign in to enable notifications");
      return;
    }
    toggleSubscription();
  };

  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleClick}
        disabled={isToggling}
        className={isSubscribed ? "text-brand border-brand" : ""}
        title={isSubscribed ? "Disable notifications" : "Get notified of new episodes"}
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4 fill-current" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isToggling}
      className={`gap-2 ${isSubscribed ? "text-brand border-brand" : ""}`}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Bell className="h-4 w-4 fill-current" />
          Notifications On
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Notify Me
        </>
      )}
    </Button>
  );
};
