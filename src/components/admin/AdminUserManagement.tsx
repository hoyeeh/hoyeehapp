import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, 
  CreditCard, 
  Key, 
  Shield, 
  RotateCcw, 
  Edit2, 
  X, 
  Check,
  Phone,
  Lock,
  Mail,
  Pencil,
  Users,
  Activity,
  Search,
  Upload,
  Download,
  History,
  Ban,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserDetailsCard, UserProfile, calculateHealthStatus } from "./UserDetailsCard";
import { UserHealthAudit } from "./UserHealthAudit";
import { UserImportWizard } from "./UserImportWizard";
import { AdminAuditLogViewer } from "./AdminAuditLogViewer";
import { format } from "date-fns";

interface Profile {
  id: string;
  display_name: string | null;
  is_subscribed: boolean | null;
  created_at: string | null;
  mobile_number: string | null;
  country: string | null;
  email?: string | null;
  avatar_url?: string | null;
  subscription_expiry?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
  pin_locked_until?: string | null;
  lockout_count?: number | null;
  parental_controls_enabled?: boolean | null;
  active_session_id?: string | null;
  is_blocked?: boolean | null;
  blocked_at?: string | null;
  blocked_reason?: string | null;
}

interface AdminUserManagementProps {
  users: Profile[];
  onRefresh: () => void;
}

export const AdminUserManagement = ({ users, onRefresh }: AdminUserManagementProps) => {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [resetSecretDialog, setResetSecretDialog] = useState<string | null>(null);
  const [editDetailsDialog, setEditDetailsDialog] = useState<string | null>(null);
  const [newSecretWord, setNewSecretWord] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [authEmails, setAuthEmails] = useState<Map<string, string>>(new Map());
  const [setPasswordDialog, setSetPasswordDialog] = useState<string | null>(null);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [blockDialog, setBlockDialog] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [editValues, setEditValues] = useState({
    display_name: "",
    email: "",
    mobile_number: "",
    country: ""
  });
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 12;

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => {
      const email = authEmails.get(user.id)?.toLowerCase() || user.email?.toLowerCase() || '';
      const name = user.display_name?.toLowerCase() || '';
      const phone = user.mobile_number || '';
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [users, searchQuery, authEmails]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage, USERS_PER_PAGE]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Fetch auth emails for all users on mount (batched to handle >100 users)
  useEffect(() => {
    const fetchAuthDetails = async () => {
      if (users.length === 0) return;
      
      const BATCH_SIZE = 100;
      const userIds = users.map(u => u.id);
      const emailMap = new Map<string, string>();
      
      // Split into batches of 100
      const batches: string[][] = [];
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        batches.push(userIds.slice(i, i + BATCH_SIZE));
      }
      
      try {
        // Fetch all batches in parallel
        const results = await Promise.all(
          batches.map(batch => 
            supabase.functions.invoke('admin-get-user-auth-details', {
              body: { userIds: batch }
            })
          )
        );

        // Combine results from all batches
        results.forEach(({ data, error }) => {
          if (!error && data?.users) {
            Object.entries(data.users).forEach(([userId, details]: [string, any]) => {
              if (details.email) {
                emailMap.set(userId, details.email);
              }
            });
          }
        });
        
        setAuthEmails(emailMap);
      } catch (err) {
        console.error('Failed to fetch auth details:', err);
      }
    };

    fetchAuthDetails();
  }, [users]);

  const handleStartEdit = (user: Profile) => {
    setSelectedUser(user.id);
    setEditValues({
      display_name: user.display_name || "",
      email: authEmails.get(user.id) || user.email || "",
      mobile_number: user.mobile_number || "",
      country: user.country || ""
    });
  };

  const handleCancelEdit = () => {
    setSelectedUser(null);
    setEditValues({ display_name: "", email: "", mobile_number: "", country: "" });
  };

  const handleSaveEdit = async (userId: string, userName?: string) => {
    setIsLoading(true);
    try {
      // Update profile fields
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: editValues.display_name || null,
          mobile_number: editValues.mobile_number || null,
          country: editValues.country || null
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Update email via edge function if changed
      const currentEmail = authEmails.get(userId);
      if (editValues.email && editValues.email !== currentEmail) {
        const { data, error } = await supabase.functions.invoke('admin-update-user-details', {
          body: { 
            targetUserId: userId,
            newEmail: editValues.email,
            newPhoneNumber: editValues.mobile_number || undefined
          }
        });

        if (error) throw error;
        if (!data?.success) {
          toast.error(data?.error || "Failed to update email");
          return;
        }
      }

      toast.success(`User details updated for ${userName || "user"}`);
      setSelectedUser(null);
      setEditValues({ display_name: "", email: "", mobile_number: "", country: "" });
      onRefresh();
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error?.message || "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAudit = () => {
    setIsAuditRunning(true);
    setTimeout(() => setIsAuditRunning(false), 1000);
  };

  const handleUpdateUserDetails = async (userId: string, userName?: string) => {
    if (!editEmail && !editPhone) {
      toast.error("Please enter at least one field to update");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user-details', {
        body: { 
          targetUserId: userId,
          newEmail: editEmail || undefined,
          newPhoneNumber: editPhone || undefined
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        toast.error(data?.error || "Failed to update user details");
        return;
      }
      
      if (data.emailSent) {
        toast.success(`User details updated. Notification sent to ${userName || "user"}`);
      } else {
        toast.warning("User details updated but notification email could not be sent");
      }
      
      setEditDetailsDialog(null);
      setEditEmail("");
      setEditPhone("");
      onRefresh();
    } catch (error: any) {
      console.error("Update details error:", error);
      toast.error(error?.message || "Failed to update user details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSubscription = async (userId: string, currentStatus: boolean) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_subscribed: !currentStatus })
        .eq("id", userId);

      if (error) throw error;
      toast.success(`Subscription ${!currentStatus ? "activated" : "deactivated"}`);
      onRefresh();
    } catch (error) {
      toast.error("Failed to update subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const sendSecurityNotification = async (email: string, actionType: "pin_reset" | "secret_reset", userName?: string) => {
    try {
      await supabase.functions.invoke('send-admin-action-notification', {
        body: { email, actionType, userName }
      });
    } catch (error) {
      console.error('Failed to send notification email:', error);
      // Don't block the main action if notification fails
    }
  };

  const handleResetPin = async (userId: string, userName?: string) => {
    setIsLoading(true);
    try {
      // Use secure RPC function with super_admin requirement, rate limiting, and audit logging
      const { data, error } = await supabase.rpc('admin_reset_pin', {
        target_user_id: userId
      });

      if (error) throw error;
      
      const result = data?.[0];
      if (!result?.success) {
        toast.error(result?.error_message || "Failed to reset PIN");
        return;
      }
      
      // Send security notification email to user
      if (result.user_email) {
        await sendSecurityNotification(result.user_email, 'pin_reset', userName);
      }
      
      toast.success("PIN has been reset securely. User has been notified.");
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset PIN");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSecret = async (userId: string, userName?: string) => {
    if (newSecretWord.length < 8) {
      toast.error("Secret word must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      // Use secure RPC function with validation, rate limiting, and audit logging
      const { data, error } = await supabase.rpc('admin_reset_secret_word', {
        target_user_id: userId,
        new_secret: newSecretWord
      });

      if (error) throw error;
      
      // Check the result from the RPC function
      const result = data?.[0];
      if (!result?.success) {
        toast.error(result?.error_message || "Failed to reset secret word");
        return;
      }
      
      // Send security notification email to user
      if (result.user_email) {
        await sendSecurityNotification(result.user_email, 'secret_reset', userName);
      }
      
      toast.success("Secret word has been reset securely. User has been notified.");
      setResetSecretDialog(null);
      setNewSecretWord("");
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset secret word");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockAccount = async (userId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          pin_attempts: 0,
          pin_locked_until: null
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Account unlocked");
      onRefresh();
    } catch (error) {
      toast.error("Failed to unlock account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userName?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          targetUserId: userId,
          sendEmail: true
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        toast.error(data?.error || "Failed to reset password");
        return;
      }
      
      if (data.emailSent) {
        toast.success(`Password reset successfully. New password sent to ${data.userEmail}`);
      } else {
        toast.warning("Password reset but email could not be sent. Please provide the new password manually.");
      }
      
      onRefresh();
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error?.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetCustomPassword = async (userId: string, userName?: string) => {
    if (!customPassword || customPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { targetUserId: userId, sendEmail: true, customPassword }
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Failed to set password");
        return;
      }
      toast.success(
        data.emailSent
          ? `Password updated and emailed to ${data.userEmail}`
          : "Password updated. Email delivery failed — share it manually."
      );
      setSetPasswordDialog(null);
      setCustomPassword("");
      setShowCustomPassword(false);
      onRefresh();
    } catch (error: any) {
      console.error("Set password error:", error);
      toast.error(error?.message || "Failed to set password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean, userName?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-block-user', {
        body: {
          targetUserId: userId,
          block: !currentlyBlocked,
          reason: !currentlyBlocked ? (blockReason || undefined) : undefined,
        }
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Failed to update block status");
        return;
      }
      toast.success(!currentlyBlocked
        ? `${userName || "User"} has been blocked`
        : `${userName || "User"} has been unblocked`);
      setBlockDialog(null);
      setBlockReason("");
      onRefresh();
    } catch (error: any) {
      console.error("Block error:", error);
      toast.error(error?.message || "Failed to update block status");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert Profile to UserProfile for components
  const toUserProfile = (user: Profile): UserProfile => ({
    id: user.id,
    display_name: user.display_name,
    email: authEmails.get(user.id) || user.email,
    mobile_number: user.mobile_number,
    country: user.country,
    avatar_url: user.avatar_url || null,
    is_subscribed: user.is_subscribed,
    subscription_expiry: user.subscription_expiry || null,
    created_at: user.created_at,
    updated_at: user.updated_at || null,
    last_login_at: user.last_login_at || null,
    pin_locked_until: user.pin_locked_until || null,
    lockout_count: user.lockout_count || null,
    parental_controls_enabled: user.parental_controls_enabled || null,
    active_session_id: user.active_session_id || null
  });

  // Export users to CSV
  const handleExportUsers = () => {
    const headers = ["ID", "Display Name", "Email", "Phone", "Country", "Subscribed", "Created At"];
    const rows = filteredUsers.map(user => [
      user.id,
      user.display_name || "",
      authEmails.get(user.id) || user.email || "",
      user.mobile_number || "",
      user.country || "",
      user.is_subscribed ? "Yes" : "No",
      user.created_at ? format(new Date(user.created_at), "yyyy-MM-dd HH:mm:ss") : ""
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredUsers.length} users to CSV`);
  };

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList className="bg-secondary">
        <TabsTrigger value="users" className="gap-1">
          <Users className="h-4 w-4" />
          All Users
        </TabsTrigger>
        <TabsTrigger value="audit" className="gap-1">
          <Activity className="h-4 w-4" />
          Health Audit
        </TabsTrigger>
        <TabsTrigger value="logs" className="gap-1">
          <History className="h-4 w-4" />
          Admin Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-6">
        {/* Search Bar and Import Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="py-2 px-3 whitespace-nowrap">
              {filteredUsers.length} of {users.length} users
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportUsers}
              className="gap-1 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportWizard(true)}
              className="gap-1 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              Import Users
            </Button>
          </div>
        </div>

        {/* Import Wizard Dialog */}
        {showImportWizard && (
          <UserImportWizard
            onClose={() => setShowImportWizard(false)}
            onSuccess={() => {
              setShowImportWizard(false);
              onRefresh();
            }}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginatedUsers.map((user) => (
          <div key={user.id} className="space-y-2">
            {/* Detailed User Card with Health Status */}
            <UserDetailsCard
              user={toUserProfile(user)}
              isEditing={selectedUser === user.id}
              editValues={editValues}
              onEditChange={(field, value) => setEditValues(prev => ({ ...prev, [field]: value }))}
              onStartEdit={() => handleStartEdit(user)}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={() => handleSaveEdit(user.id, user.display_name || undefined)}
              isLoading={isLoading}
              healthStatus={calculateHealthStatus(toUserProfile(user), authEmails.get(user.id))}
            />

            {/* Action Buttons Card */}
            <Card className="bg-card/50 border-border">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2">
                  {/* Edit User Details Dialog */}
                  <Dialog 
                    open={editDetailsDialog === user.id} 
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditDetailsDialog(null);
                        setEditEmail("");
                        setEditPhone("");
                      } else {
                        setEditDetailsDialog(user.id);
                        setEditEmail(authEmails.get(user.id) || user.email || "");
                        setEditPhone(user.mobile_number || "");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Pencil className="h-3 w-3" />
                        Quick Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit User Details</DialogTitle>
                        <DialogDescription>
                          Update contact information for {user.display_name || "this user"}. The user will be notified via email about any changes.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                          <p className="text-sm text-primary font-medium">📧 Email Notification</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            The user will receive an email notification with the updated details.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-email">Email Address</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="edit-email"
                              type="email"
                              placeholder="Enter new email address"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="pl-10 bg-secondary"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-phone">Phone Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="edit-phone"
                              type="tel"
                              placeholder="Enter new phone number"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="pl-10 bg-secondary"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="pt-4">
                        <Button variant="ghost" onClick={() => { setEditDetailsDialog(null); setEditEmail(""); setEditPhone(""); }}>
                          Cancel
                        </Button>
                        <Button
                          variant="brand"
                          onClick={() => handleUpdateUserDetails(user.id, user.display_name || undefined)}
                          disabled={isLoading || (!editEmail && !editPhone)}
                        >
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Toggle Subscription */}
                  <Button
                    variant={user.is_subscribed ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleSubscription(user.id, user.is_subscribed || false)}
                    disabled={isLoading}
                    className="gap-1"
                  >
                    <CreditCard className="h-3 w-3" />
                    {user.is_subscribed ? "Revoke" : "Grant"} Premium
                  </Button>

                  {/* Reset PIN */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetPin(user.id, user.display_name || undefined)}
                    disabled={isLoading}
                    className="gap-1"
                    title="Requires Super Admin role"
                  >
                    <Key className="h-3 w-3" />
                    Reset PIN
                  </Button>

                  {/* Reset Secret Word */}
                  <Dialog 
                    open={resetSecretDialog === user.id} 
                    onOpenChange={(open) => {
                      if (!open) {
                        setResetSecretDialog(null);
                        setNewSecretWord("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetSecretDialog(user.id)}
                        disabled={isLoading}
                        className="gap-1"
                        title="Requires Super Admin role"
                      >
                        <Shield className="h-3 w-3" />
                        Reset Secret
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset Secret Word</DialogTitle>
                        <DialogDescription>
                          Set a new secret word for {user.display_name}. The user will need this to reset their PIN.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                          <p className="text-sm text-destructive font-medium">⚠️ Super Admin Required</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This action requires Super Admin privileges and is logged.
                          </p>
                        </div>
                        <Input
                          type="text"
                          placeholder="Enter new secret word (min 8 characters)"
                          value={newSecretWord}
                          onChange={(e) => setNewSecretWord(e.target.value)}
                          className="bg-secondary"
                          minLength={8}
                        />
                        <p className="text-xs text-muted-foreground">
                          {newSecretWord.length}/8 characters minimum
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => { setResetSecretDialog(null); setNewSecretWord(""); }}>
                            Cancel
                          </Button>
                          <Button
                            variant="brand"
                            onClick={() => handleResetSecret(user.id, user.display_name || undefined)}
                            disabled={isLoading || newSecretWord.length < 8}
                          >
                            Reset Secret Word
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Reset Password */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        className="gap-1"
                        title="Reset password and send new one via email"
                      >
                        <Lock className="h-3 w-3" />
                        Reset Password
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset User Password</AlertDialogTitle>
                        <AlertDialogDescription>
                          <div className="space-y-3">
                            <p>
                              This will generate a new secure password for <strong>{user.display_name || "this user"}</strong> and send it to their email address.
                            </p>
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                              <p className="text-sm text-destructive font-medium">⚠️ Super Admin Required</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This action is logged and rate-limited.
                              </p>
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleResetPassword(user.id, user.display_name || undefined)}
                          disabled={isLoading}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Reset & Send Email
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Set Custom Password */}
                  <Dialog
                    open={setPasswordDialog === user.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setSetPasswordDialog(null);
                        setCustomPassword("");
                        setShowCustomPassword(false);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSetPasswordDialog(user.id)}
                        disabled={isLoading}
                        className="gap-1"
                        title="Assign a specific password"
                      >
                        <Key className="h-3 w-3" />
                        Set Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Password for {user.display_name || "user"}</DialogTitle>
                        <DialogDescription>
                          Assign a specific password for this account. The new password will be emailed to the user.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <p className="text-sm text-destructive font-medium">⚠️ Super Admin Required</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This action is logged. Minimum 8 characters.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="custom-password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="custom-password"
                              type={showCustomPassword ? "text" : "password"}
                              placeholder="Min 8 characters"
                              value={customPassword}
                              onChange={(e) => setCustomPassword(e.target.value)}
                              className="bg-secondary pr-10"
                              minLength={8}
                              maxLength={72}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowCustomPassword((v) => !v)}
                            >
                              {showCustomPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">{customPassword.length}/8 minimum</p>
                        </div>
                      </div>
                      <DialogFooter className="pt-2">
                        <Button variant="ghost" onClick={() => { setSetPasswordDialog(null); setCustomPassword(""); setShowCustomPassword(false); }}>
                          Cancel
                        </Button>
                        <Button
                          variant="brand"
                          onClick={() => handleSetCustomPassword(user.id, user.display_name || undefined)}
                          disabled={isLoading || customPassword.length < 8}
                        >
                          Set Password
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Block / Unblock Account */}
                  {user.is_blocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBlock(user.id, true, user.display_name || undefined)}
                      disabled={isLoading}
                      className="gap-1 border-green-500/40 text-green-500 hover:bg-green-500/10"
                      title="Unblock this account"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Unblock
                    </Button>
                  ) : (
                    <Dialog
                      open={blockDialog === user.id}
                      onOpenChange={(open) => {
                        if (!open) { setBlockDialog(null); setBlockReason(""); }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setBlockDialog(user.id)}
                          disabled={isLoading}
                          className="gap-1"
                          title="Block this account"
                        >
                          <Ban className="h-3 w-3" />
                          Block
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Block {user.display_name || "user"}?</DialogTitle>
                          <DialogDescription>
                            This will sign the user out of all devices and prevent future sign-ins until you unblock them.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="block-reason">Reason (optional)</Label>
                          <Input
                            id="block-reason"
                            placeholder="e.g. Terms of service violation"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            className="bg-secondary"
                          />
                        </div>
                        <DialogFooter className="pt-2">
                          <Button variant="ghost" onClick={() => { setBlockDialog(null); setBlockReason(""); }}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleToggleBlock(user.id, false, user.display_name || undefined)}
                            disabled={isLoading}
                          >
                            Block Account
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Unlock Account (PIN lockout) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlockAccount(user.id)}
                    disabled={isLoading}
                    className="gap-1"
                    title="Clear PIN lockout"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Unlock PIN
                  </Button>
                </div>
                {user.is_blocked && (
                  <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                    <Ban className="h-3 w-3" />
                    <span>
                      Blocked{user.blocked_at ? ` on ${format(new Date(user.blocked_at), "PP")}` : ""}
                      {user.blocked_reason ? ` — ${user.blocked_reason}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground col-span-full">
            {searchQuery ? `No users match "${searchQuery}"` : "No users found"}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * USERS_PER_PAGE) + 1}-{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="audit">
        <UserHealthAudit
          users={users.map(toUserProfile)}
          authEmails={authEmails}
          onRunAudit={handleRunAudit}
          isRunning={isAuditRunning}
        />
      </TabsContent>

      <TabsContent value="logs">
        <AdminAuditLogViewer />
      </TabsContent>
    </Tabs>
  );
};