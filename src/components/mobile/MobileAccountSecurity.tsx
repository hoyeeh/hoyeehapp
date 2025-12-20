import { useState } from "react";
import { ArrowLeft, Key, Smartphone, AlertTriangle, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MobileAccountSecurityProps {
  open: boolean;
  onClose: () => void;
}

export function MobileAccountSecurity({ open, onClose }: MobileAccountSecurityProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { lightTap, mediumTap } = useHaptics();
  
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // In a real app, this would call a backend function to delete the account
    toast.info("Please contact support to delete your account");
    setShowDeleteAccount(false);
  };

  const handleSignOutAllDevices = async () => {
    mediumTap();
    try {
      await supabase.auth.signOut({ scope: 'global' });
      toast.success("Signed out from all devices");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to sign out from all devices");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="flex flex-col h-full pt-safe">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border/10">
            <button
              onClick={() => {
                lightTap();
                onClose();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">Account Security</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {/* Email Info */}
            <div className="mb-6 p-4 bg-muted/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
              <p className="font-medium text-foreground">{user?.email}</p>
            </div>

            {/* Security Options */}
            <div className="space-y-2 mb-8">
              <button
                onClick={() => {
                  lightTap();
                  setShowChangePassword(true);
                }}
                className="w-full flex items-center gap-4 p-4 bg-muted/20 rounded-xl active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Key className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
              </button>

              <button
                onClick={handleSignOutAllDevices}
                className="w-full flex items-center gap-4 p-4 bg-muted/20 rounded-xl active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Sign Out All Devices</p>
                  <p className="text-xs text-muted-foreground">Sign out from all other sessions</p>
                </div>
              </button>
            </div>

            {/* Danger Zone */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-4">
                Danger Zone
              </h3>
              <button
                onClick={() => {
                  mediumTap();
                  setShowDeleteAccount(true);
                }}
                className="w-full flex items-center gap-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-destructive/70">Permanently delete your account and data</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Change Password Dialog */}
        <AlertDialog open={showChangePassword} onOpenChange={setShowChangePassword}>
          <AlertDialogContent className="max-w-[90vw] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Change Password</AlertDialogTitle>
              <AlertDialogDescription>
                Enter your new password below
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              <Input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
              />
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <AlertDialogFooter className="flex-row gap-2">
              <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleChangePassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="flex-1 m-0"
              >
                {isLoading ? "Updating..." : "Update Password"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Account Dialog */}
        <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
          <AlertDialogContent className="max-w-[90vw] rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Account
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All your data, including watch history, preferences, and saved content will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2">
              <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="flex-1 m-0 bg-destructive hover:bg-destructive/90"
              >
                Contact Support
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  );
}
