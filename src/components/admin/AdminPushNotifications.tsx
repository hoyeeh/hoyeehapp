import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Send, Loader2, Users, Film, AlertCircle } from "lucide-react";

const NOTIFICATION_TYPES = [
  { value: "new_content", label: "New Content Release", icon: Film },
  { value: "announcement", label: "Announcement", icon: Bell },
  { value: "subscription", label: "Subscription Reminder", icon: AlertCircle },
];

export const AdminPushNotifications = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notificationType, setNotificationType] = useState("announcement");
  const [contentId, setContentId] = useState("");

  const sendNotification = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          title,
          body,
          type: notificationType,
          contentId: contentId || undefined,
          sendToAll: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Notification sent to ${data?.notificationsSent || 0} users`);
      setTitle("");
      setBody("");
      setContentId("");
    },
    onError: (error) => {
      console.error("Send notification error:", error);
      toast.error("Failed to send notification");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    sendNotification.mutate();
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand" />
            Send Push Notification
          </CardTitle>
          <CardDescription>
            Send push notifications to all users who have enabled notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <Select value={notificationType} onValueChange={setNotificationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message *</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification message..."
                maxLength={500}
                rows={4}
                required
              />
            </div>

            {notificationType === "new_content" && (
              <div className="space-y-2">
                <Label htmlFor="contentId">Content ID (optional)</Label>
                <Input
                  id="contentId"
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                  placeholder="UUID of the content to link..."
                />
                <p className="text-xs text-muted-foreground">
                  If provided, tapping the notification will open this content
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={sendNotification.isPending}
            >
              {sendNotification.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to All Users
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Quick Templates */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Quick Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setTitle("New Movie Added!");
              setBody("Check out our latest addition to the library. Watch now!");
              setNotificationType("new_content");
            }}
          >
            <Film className="h-4 w-4 mr-2" />
            New Content Template
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setTitle("Subscription Expiring Soon");
              setBody("Your subscription expires in 3 days. Renew now to continue enjoying premium content!");
              setNotificationType("subscription");
            }}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Subscription Reminder Template
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setTitle("Weekend Watch Party!");
              setBody("Join us this weekend for exclusive content and special features. Don't miss out!");
              setNotificationType("announcement");
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            Event Announcement Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
