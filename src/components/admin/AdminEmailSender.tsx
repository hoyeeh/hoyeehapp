import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Send, Users, User, Loader2, FileEdit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type EmailType = "payment_confirmation" | "renewal_reminder" | "expiration_warning" | "subscription_cancelled" | "welcome" | "custom";

export const AdminEmailSender = () => {
  const [recipientType, setRecipientType] = useState<"individual" | "all">("individual");
  const [email, setEmail] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("welcome");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-email"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) {
        // Fallback to profiles if admin API not available
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, mobile_number");
        return profiles?.map(p => ({ 
          id: p.id, 
          email: null,
          user_metadata: { display_name: p.display_name }
        })) || [];
      }
      return data.users;
    },
  });

  const sendEmail = async (toEmail: string, userName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await supabase.functions.invoke("send-subscription-email", {
      body: {
        to: toEmail,
        type: emailType,
        data: {
          userName,
          amount: 2500,
          currency: "XAF",
          planType: "Monthly",
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          daysUntilExpiry: 7,
          // Custom email fields
          customSubject: emailType === "custom" ? customSubject : undefined,
          customMessage: emailType === "custom" ? customMessage : undefined,
        },
      },
    });

    if (response.error) throw response.error;
    return response.data;
  };

  const handleSendIndividual = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    if (emailType === "custom" && (!customSubject || !customMessage)) {
      toast.error("Please enter subject and message for custom email");
      return;
    }

    setIsSending(true);
    try {
      await sendEmail(email, "Valued Customer");
      toast.success(`Email sent successfully to ${email}`);
      setEmail("");
      if (emailType === "custom") {
        setCustomSubject("");
        setCustomMessage("");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendToAll = async () => {
    if (users.length === 0) {
      toast.error("No users found");
      return;
    }

    if (emailType === "custom" && (!customSubject || !customMessage)) {
      toast.error("Please enter subject and message for custom email");
      return;
    }

    const usersWithEmail = users.filter(u => u.email);
    if (usersWithEmail.length === 0) {
      toast.error("No users with email addresses found");
      return;
    }

    setIsSending(true);
    setProgress({ sent: 0, total: usersWithEmail.length });

    let successCount = 0;
    let failCount = 0;

    for (const user of usersWithEmail) {
      try {
        await sendEmail(
          user.email!,
          user.user_metadata?.display_name || "Valued Customer"
        );
        successCount++;
        setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to send to ${user.email}:`, error);
        failCount++;
      }
    }

    setIsSending(false);
    setProgress({ sent: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} emails`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} emails`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Send Emails
        </CardTitle>
        <CardDescription>
          Send emails to individual users or broadcast to all users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recipient Type Selection */}
        <div className="flex gap-4">
          <Button
            variant={recipientType === "individual" ? "default" : "outline"}
            onClick={() => setRecipientType("individual")}
            className="flex-1"
          >
            <User className="h-4 w-4 mr-2" />
            Individual
          </Button>
          <Button
            variant={recipientType === "all" ? "default" : "outline"}
            onClick={() => setRecipientType("all")}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            All Users
          </Button>
        </div>

        {/* Email Type Selection */}
        <div className="space-y-2">
          <Label>Email Type</Label>
          <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select email type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="welcome">Welcome Email</SelectItem>
              <SelectItem value="payment_confirmation">Payment Confirmation</SelectItem>
              <SelectItem value="renewal_reminder">Renewal Reminder</SelectItem>
              <SelectItem value="expiration_warning">Expiration Warning</SelectItem>
              <SelectItem value="subscription_cancelled">Subscription Cancelled</SelectItem>
              <SelectItem value="custom">
                <span className="flex items-center gap-2">
                  <FileEdit className="h-4 w-4" />
                  Custom Email
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Email Fields */}
        {emailType === "custom" && (
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                placeholder="Enter email subject..."
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Message</Label>
              <Textarea
                placeholder="Enter your message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{userName}"} to include the recipient's name in your message.
              </p>
            </div>
          </div>
        )}

        {/* Individual Email Input */}
        {recipientType === "individual" && (
          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        {/* All Users Info */}
        {recipientType === "all" && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              This will send the selected email template to all {users.filter(u => u.email).length} users with registered email addresses.
            </p>
          </div>
        )}

        {/* Progress indicator */}
        {isSending && progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Sending emails...</span>
              <span>{progress.sent} / {progress.total}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(progress.sent / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={recipientType === "individual" ? handleSendIndividual : handleSendToAll}
          disabled={isSending || (recipientType === "individual" && !email)}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {recipientType === "individual" ? "Send Email" : `Send to All Users`}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminEmailSender;
