import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Phone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  display_name: string | null;
  is_subscribed: boolean | null;
  created_at: string | null;
  mobile_number: string | null;
  country: string | null;
}

interface AdminUserManagementProps {
  users: Profile[];
  onRefresh: () => void;
}

export const AdminUserManagement = ({ users, onRefresh }: AdminUserManagementProps) => {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [resetSecretDialog, setResetSecretDialog] = useState<string | null>(null);
  const [newSecretWord, setNewSecretWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <Card key={user.id} className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {user.display_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    {user.display_name || "Unknown User"}
                    {user.is_subscribed && (
                      <Badge variant="default" className="bg-brand text-xs">Premium</Badge>
                    )}
                  </h3>
                  {user.mobile_number && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {user.mobile_number}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(user.created_at || "").toLocaleDateString()}
                  </p>
                  {user.country && (
                    <p className="text-sm text-muted-foreground">
                      {user.country}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
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

                {/* Reset PIN - Requires Super Admin */}
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

                {/* Reset Secret Word - Requires Super Admin */}
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
                          This action requires Super Admin privileges, is logged and rate-limited. The secret word must be at least 8 characters and cannot be a common word. The user will be notified via email.
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
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setResetSecretDialog(null);
                            setNewSecretWord("");
                          }}
                        >
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

                {/* Unlock Account */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlockAccount(user.id)}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Unlock
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {users.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  );
};