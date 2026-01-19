import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard,
  Shield,
  Lock,
  Clock,
  Activity,
  Edit3,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

export interface UserProfile {
  id: string;
  display_name: string | null;
  email?: string | null;
  mobile_number: string | null;
  country: string | null;
  avatar_url: string | null;
  is_subscribed: boolean | null;
  subscription_expiry: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
  pin_locked_until: string | null;
  lockout_count: number | null;
  parental_controls_enabled: boolean | null;
  has_parental_pin?: boolean;
  active_session_id: string | null;
}

export interface UserHealthStatus {
  hasEmail: boolean;
  hasPhone: boolean;
  hasDisplayName: boolean;
  isAccountLocked: boolean;
  isSubscriptionExpired: boolean;
  hasRecentLogin: boolean;
  hasMultipleLockouts: boolean;
  overallHealth: 'good' | 'warning' | 'critical';
  issues: string[];
}

interface UserDetailsCardProps {
  user: UserProfile;
  isEditing: boolean;
  editValues: {
    display_name: string;
    email: string;
    mobile_number: string;
    country: string;
  };
  onEditChange: (field: string, value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  isLoading: boolean;
  healthStatus: UserHealthStatus;
}

export const UserDetailsCard = ({
  user,
  isEditing,
  editValues,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isLoading,
  healthStatus
}: UserDetailsCardProps) => {
  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return format(new Date(date), "PPp");
  };

  const getHealthBadge = () => {
    switch (healthStatus.overallHealth) {
      case 'good':
        return <Badge className="bg-green-500/20 text-green-400 gap-1"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 gap-1"><AlertTriangle className="h-3 w-3" /> Issues</Badge>;
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 gap-1"><XCircle className="h-3 w-3" /> Critical</Badge>;
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {user.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {user.display_name || "Unknown User"}
                {user.is_subscribed && (
                  <Badge variant="default" className="bg-brand text-xs">Premium</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getHealthBadge()}
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={onStartEdit} className="gap-1">
                <Edit3 className="h-3 w-3" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={onCancelEdit} disabled={isLoading}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="brand" size="sm" onClick={onSaveEdit} disabled={isLoading} className="gap-1">
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Health Issues Alert */}
        {healthStatus.issues.length > 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm font-medium text-destructive mb-2">Health Issues Detected:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {healthStatus.issues.map((issue, i) => (
                <li key={i} className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <User className="h-4 w-4" /> Contact Information
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24">Display Name</Label>
                {isEditing ? (
                  <Input 
                    value={editValues.display_name}
                    onChange={(e) => onEditChange('display_name', e.target.value)}
                    className="h-8 text-sm bg-secondary"
                    placeholder="Enter display name"
                  />
                ) : (
                  <span className="text-sm">{user.display_name || <span className="text-muted-foreground italic">Not set</span>}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                {isEditing ? (
                  <Input 
                    type="email"
                    value={editValues.email}
                    onChange={(e) => onEditChange('email', e.target.value)}
                    className="h-8 text-sm bg-secondary"
                    placeholder="Enter email"
                  />
                ) : (
                  <span className="text-sm">{user.email || <span className="text-muted-foreground italic">Not set</span>}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                {isEditing ? (
                  <Input 
                    type="tel"
                    value={editValues.mobile_number}
                    onChange={(e) => onEditChange('mobile_number', e.target.value)}
                    className="h-8 text-sm bg-secondary"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <span className="text-sm">{user.mobile_number || <span className="text-muted-foreground italic">Not set</span>}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Country
                </Label>
                {isEditing ? (
                  <Input 
                    value={editValues.country}
                    onChange={(e) => onEditChange('country', e.target.value)}
                    className="h-8 text-sm bg-secondary"
                    placeholder="Enter country"
                  />
                ) : (
                  <span className="text-sm">{user.country || <span className="text-muted-foreground italic">Not set</span>}</span>
                )}
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Activity className="h-4 w-4" /> Account Status
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Subscription
                </Label>
                <div className="flex items-center gap-2">
                  {user.is_subscribed ? (
                    <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                  {user.subscription_expiry && (
                    <span className="text-xs text-muted-foreground">
                      Expires: {formatDate(user.subscription_expiry)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Account Lock
                </Label>
                {user.pin_locked_until && new Date(user.pin_locked_until) > new Date() ? (
                  <Badge className="bg-red-500/20 text-red-400">Locked until {formatDate(user.pin_locked_until)}</Badge>
                ) : (
                  <Badge className="bg-green-500/20 text-green-400">Unlocked</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Lockouts
                </Label>
                <span className="text-sm">{user.lockout_count || 0} times</span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-24 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Parental
                </Label>
                {user.parental_controls_enabled ? (
                  <Badge className="bg-blue-500/20 text-blue-400">Enabled</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Registered</p>
              <p className="text-sm">{formatDate(user.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Login</p>
              <p className="text-sm">{formatDate(user.last_login_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm">{formatDate(user.updated_at)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const calculateHealthStatus = (user: UserProfile, authEmail?: string): UserHealthStatus => {
  const issues: string[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  // Check for email
  const hasEmail = !!authEmail || !!user.email;
  if (!hasEmail) {
    issues.push("No email address configured");
    criticalCount++;
  }

  // Check for phone
  const hasPhone = !!user.mobile_number;
  if (!hasPhone) {
    issues.push("No phone number set");
    warningCount++;
  }

  // Check for display name
  const hasDisplayName = !!user.display_name;
  if (!hasDisplayName) {
    issues.push("Display name not set");
    warningCount++;
  }

  // Check if account is locked
  const isAccountLocked = user.pin_locked_until ? new Date(user.pin_locked_until) > new Date() : false;
  if (isAccountLocked) {
    issues.push("Account is currently locked");
    criticalCount++;
  }

  // Check subscription expiry
  const isSubscriptionExpired = user.is_subscribed && user.subscription_expiry 
    ? new Date(user.subscription_expiry) < new Date() 
    : false;
  if (isSubscriptionExpired) {
    issues.push("Subscription has expired but still marked as subscribed");
    warningCount++;
  }

  // Check for recent login (within last 30 days)
  const hasRecentLogin = user.last_login_at 
    ? new Date(user.last_login_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : false;
  if (!hasRecentLogin && user.last_login_at) {
    issues.push("User hasn't logged in for 30+ days");
  }

  // Check for multiple lockouts
  const hasMultipleLockouts = (user.lockout_count || 0) > 3;
  if (hasMultipleLockouts) {
    issues.push(`User has been locked out ${user.lockout_count} times`);
    warningCount++;
  }

  let overallHealth: 'good' | 'warning' | 'critical' = 'good';
  if (criticalCount > 0) {
    overallHealth = 'critical';
  } else if (warningCount > 0) {
    overallHealth = 'warning';
  }

  return {
    hasEmail,
    hasPhone,
    hasDisplayName,
    isAccountLocked,
    isSubscriptionExpired,
    hasRecentLogin,
    hasMultipleLockouts,
    overallHealth,
    issues
  };
};
