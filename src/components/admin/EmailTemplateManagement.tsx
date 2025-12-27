import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Edit,
  Eye,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Code,
  Variable,
} from "lucide-react";
import { format } from "date-fns";
import {
  useEmailTemplates,
  useUpdateEmailTemplate,
  useToggleEmailTemplate,
  useSendTestEmail,
  EMAIL_CATEGORIES,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";
import { cn } from "@/lib/utils";

export function EmailTemplateManagement() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [testEmailDialog, setTestEmailDialog] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const { data: templates, isLoading } = useEmailTemplates(selectedCategory);
  const updateTemplate = useUpdateEmailTemplate();
  const toggleTemplate = useToggleEmailTemplate();
  const sendTestEmail = useSendTestEmail();

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    subject: "",
    html_content: "",
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditTemplate(template);
    setEditForm({
      name: template.name,
      description: template.description || "",
      subject: template.subject,
      html_content: template.html_content,
    });
  };

  const handleSaveEdit = () => {
    if (!editTemplate) return;
    updateTemplate.mutate(
      { id: editTemplate.id, updates: editForm },
      { onSuccess: () => setEditTemplate(null) }
    );
  };

  const handleSendTest = () => {
    if (!testEmailDialog || !testEmail) return;
    sendTestEmail.mutate(
      { templateKey: testEmailDialog.template_key, testEmail },
      { onSuccess: () => setTestEmailDialog(null) }
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "subscription":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "user":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "creator":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "content":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "support":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const wrapHtmlWithBaseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png" width="150" height="auto" alt="Hoyeeh" style="margin: 0 auto;">
    </div>
    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
      ${content}
    </div>
    <hr style="border-color: #333; margin: 32px 0;">
    <div style="text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">© ${new Date().getFullYear()} Hoyeeh. All rights reserved.</p>
      <p style="color: #666; font-size: 12px; margin: 0;">
        <a href="https://hoyeeh.com" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a> • 
        <a href="https://hoyeeh.com/subscription" style="color: #ff6300; text-decoration: none;">Manage Subscription</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Templates
          </h2>
          <p className="text-muted-foreground">Manage email templates sent to users</p>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex-wrap h-auto gap-1">
          {EMAIL_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates?.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.template_key}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", getCategoryColor(template.category))}>
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="truncate max-w-[200px] block">{template.subject}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {template.variables.slice(0, 3).map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">
                              {v}
                            </Badge>
                          ))}
                          {template.variables.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.variables.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={(checked) =>
                              toggleTemplate.mutate({ id: template.id, is_active: checked })
                            }
                          />
                          {template.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(template.updated_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewTemplate(template)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTestEmailDialog(template);
                              setTestEmail("");
                            }}
                            title="Send Test"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Template: {editTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Update the email template content. Use {"{{variableName}}"} for dynamic content.
            </DialogDescription>
          </DialogHeader>

          {editTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    value={editForm.subject}
                    onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of when this email is sent"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    HTML Content
                  </Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Variable className="h-3 w-3" />
                    Available: {editTemplate.variables.join(", ")}
                  </div>
                </div>
                <Textarea
                  value={editForm.html_content}
                  onChange={(e) => setEditForm((f) => ({ ...f, html_content: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateTemplate.isPending}>
              {updateTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>Subject: {previewTemplate?.subject}</DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="border rounded-lg overflow-hidden bg-background">
              <iframe
                srcDoc={wrapHtmlWithBaseTemplate(previewTemplate.html_content)}
                className="w-full h-[500px] border-0"
                title="Email Preview"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  setTestEmailDialog(previewTemplate);
                  setPreviewTemplate(null);
                  setTestEmail("");
                }
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Test Dialog */}
      <Dialog open={!!testEmailDialog} onOpenChange={() => setTestEmailDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send a test email for "{testEmailDialog?.name}" template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Test Email Address</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Test data will be used for all template variables.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={!testEmail || sendTestEmail.isPending}
            >
              {sendTestEmail.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Test Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmailTemplateManagement;
