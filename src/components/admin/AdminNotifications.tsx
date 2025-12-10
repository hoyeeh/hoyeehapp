import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSendNotification } from "@/hooks/useNotifications";
import { Bell, Send } from "lucide-react";

export const AdminNotifications = () => {
  const { toast } = useToast();
  const sendNotification = useSendNotification();
  
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "announcement",
    sendToAll: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title || !form.body) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }

    try {
      await sendNotification.mutateAsync({
        title: form.title,
        body: form.body,
        type: form.type,
        sendToAll: form.sendToAll,
      });
      
      toast({ title: "Notification sent successfully" });
      setForm({ title: "", body: "", type: "announcement", sendToAll: true });
    } catch (error) {
      toast({ title: "Failed to send notification", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display">Send Notifications</h2>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            New Notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            
            <div>
              <Label>Message</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Enter your notification message..."
                rows={4}
              />
            </div>

            <div>
              <Label>Type</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full p-2 rounded-lg border border-border bg-background"
              >
                <option value="announcement">Announcement</option>
                <option value="new_content">New Content</option>
                <option value="subscription">Subscription</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Send to all users</Label>
              <Switch
                checked={form.sendToAll}
                onCheckedChange={(checked) => setForm({ ...form, sendToAll: checked })}
              />
            </div>

            <Button 
              type="submit" 
              disabled={sendNotification.isPending}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendNotification.isPending ? "Sending..." : "Send Notification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
