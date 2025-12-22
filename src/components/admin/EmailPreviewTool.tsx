import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, Eye, RefreshCw, Send, Copy, Check, Loader2,
  CreditCard, Clock, AlertTriangle, XCircle, UserPlus, MessageSquare, Baby
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const EMAIL_TEMPLATES = {
  welcome: {
    name: "Welcome Email",
    icon: UserPlus,
    description: "Sent when a new user signs up",
    color: "text-green-500",
  },
  payment_confirmation: {
    name: "Payment Confirmation",
    icon: CreditCard,
    description: "Sent after successful payment",
    color: "text-blue-500",
  },
  renewal_reminder: {
    name: "Renewal Reminder",
    icon: Clock,
    description: "Sent before subscription renews",
    color: "text-yellow-500",
  },
  expiration_warning: {
    name: "Expiration Warning",
    icon: AlertTriangle,
    description: "Sent when subscription is about to expire",
    color: "text-orange-500",
  },
  subscription_cancelled: {
    name: "Subscription Cancelled",
    icon: XCircle,
    description: "Sent when user cancels subscription",
    color: "text-red-500",
  },
  support_reply: {
    name: "Support Reply",
    icon: MessageSquare,
    description: "Sent when admin replies to support ticket",
    color: "text-purple-500",
  },
  kids_time_limit: {
    name: "Kids Time Limit",
    icon: Baby,
    description: "Sent when child reaches daily limit",
    color: "text-pink-500",
  },
};

const SAMPLE_DATA = {
  userName: "John Doe",
  amount: 2500,
  currency: "XAF",
  planType: "Monthly Premium",
  expiryDate: "January 15, 2025",
  daysUntilExpiry: 7,
  ticketSubject: "Unable to play video",
  replyMessage: "Thank you for reaching out! We've identified the issue and it should be resolved now. Please try playing the video again. If you continue to experience problems, please let us know.",
  childName: "Alex",
  totalMinutes: 120,
  dailyLimit: 120,
  viewingSummary: [
    { title: "Paw Patrol", minutes: 45 },
    { title: "Bluey", minutes: 30 },
    { title: "Cocomelon", minutes: 45 },
  ],
  recommendations: ["Peppa Pig", "Dora the Explorer", "Mickey Mouse Clubhouse"],
};

export const EmailPreviewTool = () => {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof EMAIL_TEMPLATES>("welcome");
  const [sampleData, setSampleData] = useState(SAMPLE_DATA);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const generateEmailHtml = (template: keyof typeof EMAIL_TEMPLATES) => {
    const { userName, amount, currency, planType, expiryDate, daysUntilExpiry, ticketSubject, replyMessage, childName, totalMinutes, dailyLimit, viewingSummary, recommendations } = sampleData;
    
    const logoUrl = "https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png";
    const baseUrl = "https://hoyeeh.com";
    
    const styles = {
      heading: 'color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;',
      text: 'color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;',
      highlight: 'color: #ff6300; font-weight: 600;',
      infoBox: 'background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;',
      infoBoxBorder: 'background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;',
      button: 'display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;',
      muted: 'color: #888; font-size: 14px; margin: 16px 0 0 0;',
    };

    const wrapper = (content: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="${logoUrl}" width="150" height="auto" alt="Hoyeeh" style="margin: 0 auto;">
          </div>
          <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
            ${content}
          </div>
          <hr style="border-color: #333; margin: 32px 0;">
          <div style="text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
              © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
            </p>
            <p style="color: #666; font-size: 12px; margin: 0;">
              <a href="${baseUrl}" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
              &bull;
              <a href="${baseUrl}/subscription" style="color: #ff6300; text-decoration: none;">Manage Subscription</a>
              &bull;
              <a href="${baseUrl}/notifications" style="color: #ff6300; text-decoration: none;">Email Preferences</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    switch (template) {
      case "welcome":
        return wrapper(`
          <h1 style="${styles.heading}">Welcome to Hoyeeh! 🎬</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Thank you for joining Hoyeeh - Africa's premier streaming platform!</p>
          <div style="${styles.infoBox}">
            <p style="color: #e0e0e0; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Here's what you can do:</p>
            <ul style="color: #e0e0e0; font-size: 14px; margin: 12px 0; padding-left: 20px;">
              <li>Browse our collection of African movies and TV shows</li>
              <li>Create up to 5 profiles for your family</li>
              <li>Set up a Kids profile for age-appropriate content</li>
              <li>Subscribe to Premium for unlimited access</li>
            </ul>
          </div>
          <a href="${baseUrl}" style="${styles.button}">Start Exploring</a>
          <p style="${styles.muted}">Questions? We're here to help at support@hoyeeh.com</p>
        `);

      case "payment_confirmation":
        return wrapper(`
          <h1 style="${styles.heading}">Payment Confirmed!</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Thank you for your payment. Your Hoyeeh Premium subscription is now active!</p>
          <div style="${styles.infoBox}">
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> ${planType}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> ${amount.toLocaleString()} ${currency}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Valid Until:</strong> ${expiryDate}</p>
          </div>
          <p style="${styles.text}">Enjoy unlimited access to African movies, TV shows, and exclusive content!</p>
          <a href="${baseUrl}" style="${styles.button}">Start Watching Now</a>
          <p style="${styles.muted}">If you have any questions, contact us at support@hoyeeh.com</p>
        `);

      case "renewal_reminder":
        return wrapper(`
          <h1 style="${styles.heading}">Subscription Renewal Reminder</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Your Hoyeeh Premium subscription will automatically renew in <strong>${daysUntilExpiry} days</strong>.</p>
          <div style="${styles.infoBox}">
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> ${planType}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> ${amount.toLocaleString()} ${currency}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Renewal Date:</strong> ${expiryDate}</p>
          </div>
          <p style="${styles.text}">No action is required. Your subscription will continue seamlessly.</p>
          <a href="${baseUrl}/subscription" style="${styles.button}">Manage Subscription</a>
          <p style="${styles.muted}">Questions? Contact us at support@hoyeeh.com</p>
        `);

      case "expiration_warning":
        return wrapper(`
          <h1 style="color: #ff6300; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">⚠️ Subscription Expiring Soon</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Your Hoyeeh Premium subscription will expire in <strong style="color: #ff6300;">${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""}</strong>.</p>
          <div style="${styles.infoBoxBorder}">
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Expiry Date:</strong> ${expiryDate}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Current Plan:</strong> ${planType}</p>
          </div>
          <p style="${styles.text}">Don't lose access to your favorite African content! Renew now to continue enjoying:</p>
          <ul style="color: #e0e0e0; font-size: 14px; margin: 12px 0; padding-left: 20px;">
            <li>Unlimited streaming of movies and TV shows</li>
            <li>Exclusive African content</li>
            <li>Watch on any device</li>
            <li>Download for offline viewing</li>
          </ul>
          <a href="${baseUrl}/subscription" style="${styles.button}">Renew Now</a>
          <p style="${styles.muted}">Need help? Contact support@hoyeeh.com</p>
        `);

      case "subscription_cancelled":
        return wrapper(`
          <h1 style="${styles.heading}">Subscription Cancelled</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Your Hoyeeh Premium subscription has been cancelled as requested.</p>
          <div style="${styles.infoBox}">
            <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Access Until:</strong> ${expiryDate}</p>
          </div>
          <p style="${styles.text}">You can continue enjoying premium content until ${expiryDate}. After that, your account will revert to free access.</p>
          <p style="${styles.text}">We'd love to have you back! You can resubscribe anytime to regain full access to our library.</p>
          <a href="${baseUrl}/subscription" style="${styles.button}">Resubscribe</a>
          <p style="${styles.muted}">Feedback? Let us know at info@hoyeeh.com</p>
        `);

      case "support_reply":
        return wrapper(`
          <h1 style="${styles.heading}">Support Reply</h1>
          <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
          <p style="${styles.text}">Our support team has replied to your ticket:</p>
          <div style="${styles.infoBoxBorder}">
            <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Ticket:</strong> ${ticketSubject}</p>
            <p style="color: #e0e0e0; font-size: 14px; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
          </div>
          <p style="${styles.text}">You can reply to this message in the app.</p>
          <a href="${baseUrl}" style="${styles.button}">View Conversation</a>
          <p style="${styles.muted}">Thank you for contacting Hoyeeh Support!</p>
        `);

      case "kids_time_limit":
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const watchTimeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        
        return wrapper(`
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">⏰</span>
            <h1 style="${styles.heading}">Daily Watch Time Complete!</h1>
            <p style="color: #888; margin: 0; font-size: 16px;">${childName} has reached their daily limit</p>
          </div>
          
          <p style="${styles.text}">Hello ${userName},</p>
          <p style="${styles.text}">${childName} has finished their daily screen time allowance. Here's a summary:</p>
          
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${watchTimeDisplay}</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">Total Watched</div>
            </div>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #4ade80;">${dailyLimit}m</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">Daily Limit</div>
            </div>
          </div>
          
          <div style="${styles.infoBox}">
            <h3 style="color: #ffffff; margin: 0 0 16px 0; font-size: 16px;">📺 Content Watched</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${viewingSummary.map(v => `
                <tr>
                  <td style="padding: 8px 0; color: #e0e0e0; font-size: 14px; border-bottom: 1px solid #333;">${v.title}</td>
                  <td style="padding: 8px 0; color: #ff6300; font-size: 14px; border-bottom: 1px solid #333; text-align: right;">${v.minutes}m</td>
                </tr>
              `).join('')}
            </table>
          </div>
          
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a1a10 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #ff6300;">
            <h3 style="color: #ffffff; margin: 0 0 8px 0; font-size: 16px;">⚡ Quick Actions</h3>
            <p style="color: #888; font-size: 14px; margin: 0 0 16px 0;">Need to adjust ${childName}'s limit?</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <a href="${baseUrl}/api/adjust-time?action=add15" style="background: #1f1f1f; color: #e0e0e0; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">+15 min</a>
              <a href="${baseUrl}/api/adjust-time?action=add30" style="background: #1f1f1f; color: #e0e0e0; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">+30 min</a>
              <a href="${baseUrl}/api/adjust-time?action=reset" style="background: #ff6300; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Reset Timer</a>
            </div>
          </div>
          
          <div style="${styles.infoBox}">
            <h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 16px;">✨ Recommended for Tomorrow</h3>
            ${recommendations.map(r => `
              <div style="background: #0a0a0a; padding: 10px 14px; border-radius: 8px; margin: 6px 0;">
                <span style="color: #e0e0e0; font-size: 14px;">🎬 ${r}</span>
              </div>
            `).join('')}
          </div>
          
          <div style="text-align: center;">
            <a href="${baseUrl}/parental" style="${styles.button}">View Parental Dashboard</a>
          </div>
        `);

      default:
        return wrapper(`<p style="${styles.text}">Template not found</p>`);
    }
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(generateEmailHtml(selectedTemplate));
    setCopied(true);
    toast.success("HTML copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestEmail = async () => {
    if (!user?.email) {
      toast.error("No email address found for your account");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          templateType: selectedTemplate,
          emailHtml: generateEmailHtml(selectedTemplate),
          recipientEmail: user.email,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${user.email}`);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Email Preview Tool</h2>
          <p className="text-muted-foreground">Preview and test all email templates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selector */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Templates</CardTitle>
              <CardDescription>Select a template to preview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTemplate(key as keyof typeof EMAIL_TEMPLATES)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                      isSelected 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${template.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Sample Data Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sample Data</CardTitle>
              <CardDescription>Edit preview data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">User Name</Label>
                <Input 
                  value={sampleData.userName}
                  onChange={(e) => setSampleData({...sampleData, userName: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input 
                    type="number"
                    value={sampleData.amount}
                    onChange={(e) => setSampleData({...sampleData, amount: parseInt(e.target.value) || 0})}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input 
                    value={sampleData.currency}
                    onChange={(e) => setSampleData({...sampleData, currency: e.target.value})}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Days Until Expiry</Label>
                <Input 
                  type="number"
                  value={sampleData.daysUntilExpiry}
                  onChange={(e) => setSampleData({...sampleData, daysUntilExpiry: parseInt(e.target.value) || 0})}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Child Name</Label>
                <Input 
                  value={sampleData.childName}
                  onChange={(e) => setSampleData({...sampleData, childName: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setSampleData(SAMPLE_DATA)}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Reset to Default
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Email Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview: {EMAIL_TEMPLATES[selectedTemplate].name}
                </CardTitle>
                <CardDescription>
                  How this email will appear to recipients
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyHtml}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy HTML
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendTestEmail}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-[#0a0a0a]">
                <ScrollArea className="h-[600px]">
                  <iframe
                    srcDoc={generateEmailHtml(selectedTemplate)}
                    className="w-full min-h-[600px] border-0"
                    title="Email Preview"
                  />
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};