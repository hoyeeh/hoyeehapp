import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bell, BellRing, Film, Calendar, CreditCard, Mail, Megaphone, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const NotificationPreferences = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences, isLoading, updatePreferences } = useNotificationPreferences();
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to manage notifications</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading preferences..." />
      </div>
    );
  }

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences.mutate({ [key]: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notification Preferences</h1>
            <p className="text-sm text-muted-foreground">Choose what notifications you want to receive</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Push Notifications */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="h-5 w-5 text-primary" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Receive instant notifications on your device
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSupported ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {isSubscribed ? "Push notifications enabled" : "Enable push notifications"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed 
                        ? "You'll receive notifications even when the app is closed" 
                        : "Get notified about new content and updates"}
                    </p>
                  </div>
                  <Button
                    variant={isSubscribed ? "secondary" : "default"}
                    onClick={isSubscribed ? unsubscribe : subscribe}
                    disabled={pushLoading}
                  >
                    {pushLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isSubscribed ? "Disable" : "Enable"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Push notifications are not supported on this device or browser.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Email Notification Types */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Notification Types
              </CardTitle>
              <CardDescription>
                Select which types of notifications you'd like to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* New Releases */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Film className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">New Releases</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new movies or shows are added
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.new_releases ?? true}
                  onCheckedChange={(checked) => handleToggle("new_releases", checked)}
                  disabled={updatePreferences.isPending}
                />
              </div>

              <Separator />

              {/* Coming Soon */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Coming Soon Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Notifications for content you've added to your coming soon list
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.coming_soon_alerts ?? true}
                  onCheckedChange={(checked) => handleToggle("coming_soon_alerts", checked)}
                  disabled={updatePreferences.isPending}
                />
              </div>

              <Separator />

              {/* Subscription Reminders */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Subscription Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Get reminded before your subscription expires
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.subscription_reminders ?? true}
                  onCheckedChange={(checked) => handleToggle("subscription_reminders", checked)}
                  disabled={updatePreferences.isPending}
                />
              </div>

              <Separator />

              {/* Weekly Digest */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Weekly Digest</p>
                    <p className="text-sm text-muted-foreground">
                      A weekly summary of new content and recommendations
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.weekly_digest ?? false}
                  onCheckedChange={(checked) => handleToggle("weekly_digest", checked)}
                  disabled={updatePreferences.isPending}
                />
              </div>

              <Separator />

              {/* Promotional */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Megaphone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Promotional</p>
                    <p className="text-sm text-muted-foreground">
                      Special offers, discounts, and promotional content
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.promotional ?? false}
                  onCheckedChange={(checked) => handleToggle("promotional", checked)}
                  disabled={updatePreferences.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            You can change these preferences at any time. Some notifications like 
            security alerts cannot be disabled.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;
