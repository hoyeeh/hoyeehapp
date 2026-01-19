import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  XCircle,
  ChevronDown,
  ChevronUp
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
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return format(new Date(date), "PP");
  };

  const getHealthBadge = () => {
    switch (healthStatus.overallHealth) {
      case 'good':
        return <Badge className="bg-green-500/20 text-green-400 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /></Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 gap-1 text-xs"><AlertTriangle className="h-3 w-3" /></Badge>;
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 gap-1 text-xs"><XCircle className="h-3 w-3" /></Badge>;
    }
  };

  return (
    <Card className="bg-card border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {user.display_name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CardTitle className="text-sm truncate">
                    {user.display_name || "Unknown"}
                  </CardTitle>
                  {user.is_subscribed && (
                    <Badge variant="default" className="bg-brand text-[10px] px-1.5 py-0">Pro</Badge>
                  )}
                  {getHealthBadge()}
                </div>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0" />
                  {user.email || "No email"}
                </p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-3">
            <Separator />

            {/* Health Issues Alert */}
            {healthStatus.issues.length > 0 && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {healthStatus.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      <span className="truncate">{issue}</span>
                    </li>
                  ))}
                  {healthStatus.issues.length > 3 && (
                    <li className="text-destructive text-xs">+{healthStatus.issues.length - 3} more issues</li>
                  )}
                </ul>
              </div>
            )}

            {/* Edit/View Toggle */}
            <div className="flex justify-end gap-1">
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={onStartEdit} className="gap-1 h-7 text-xs">
                  <Edit3 className="h-3 w-3" /> Edit
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={onCancelEdit} disabled={isLoading} className="h-7">
                    <X className="h-3 w-3" />
                  </Button>
                  <Button variant="brand" size="sm" onClick={onSaveEdit} disabled={isLoading} className="gap-1 h-7 text-xs">
                    <Save className="h-3 w-3" /> Save
                  </Button>
                </>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Contact Info</h4>
              
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Name</Label>
                  {isEditing ? (
                    <Input 
                      value={editValues.display_name}
                      onChange={(e) => onEditChange('display_name', e.target.value)}
                      className="h-7 text-xs bg-secondary"
                      placeholder="Display name"
                    />
                  ) : (
                    <span className="text-xs truncate">{user.display_name || <span className="italic text-muted-foreground">Not set</span>}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Email</Label>
                  {isEditing ? (
                    <Input 
                      type="email"
                      value={editValues.email}
                      onChange={(e) => onEditChange('email', e.target.value)}
                      className="h-7 text-xs bg-secondary"
                      placeholder="Email"
                    />
                  ) : (
                    <span className="text-xs truncate">{user.email || <span className="italic text-muted-foreground">Not set</span>}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Phone</Label>
                  {isEditing ? (
                    <Input 
                      type="tel"
                      value={editValues.mobile_number}
                      onChange={(e) => onEditChange('mobile_number', e.target.value)}
                      className="h-7 text-xs bg-secondary"
                      placeholder="Phone"
                    />
                  ) : (
                    <span className="text-xs truncate">{user.mobile_number || <span className="italic text-muted-foreground">Not set</span>}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-16 shrink-0">Country</Label>
                  {isEditing ? (
                    <Input 
                      value={editValues.country}
                      onChange={(e) => onEditChange('country', e.target.value)}
                      className="h-7 text-xs bg-secondary"
                      placeholder="Country"
                    />
                  ) : (
                    <span className="text-xs truncate">{user.country || <span className="italic text-muted-foreground">Not set</span>}</span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Account Status */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Account Status</h4>
              
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  {user.is_subscribed ? (
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">Premium</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Free</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  {user.pin_locked_until && new Date(user.pin_locked_until) > new Date() ? (
                    <Badge className="bg-red-500/20 text-red-400 text-[10px]">Locked</Badge>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">OK</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                  <span>{user.lockout_count || 0} lockouts</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  {user.parental_controls_enabled ? (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Parental</Badge>
                  ) : (
                    <span className="text-muted-foreground">No controls</span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Timestamps - Compact */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <span className="text-muted-foreground">Joined: </span>
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last login: </span>
                <span>{formatDate(user.last_login_at)}</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">ID: {user.id}</p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const calculateHealthStatus = (user: UserProfile, authEmail?: string): UserHealthStatus => {
  const issues: string[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  const hasEmail = !!authEmail || !!user.email;
  if (!hasEmail) {
    issues.push("No email address");
    criticalCount++;
  }

  const hasPhone = !!user.mobile_number;
  if (!hasPhone) {
    issues.push("No phone number");
    warningCount++;
  }

  const hasDisplayName = !!user.display_name;
  if (!hasDisplayName) {
    issues.push("No display name");
    warningCount++;
  }

  const isAccountLocked = user.pin_locked_until ? new Date(user.pin_locked_until) > new Date() : false;
  if (isAccountLocked) {
    issues.push("Account locked");
    criticalCount++;
  }

  const isSubscriptionExpired = user.is_subscribed && user.subscription_expiry 
    ? new Date(user.subscription_expiry) < new Date() 
    : false;
  if (isSubscriptionExpired) {
    issues.push("Subscription expired");
    warningCount++;
  }

  const hasRecentLogin = user.last_login_at 
    ? new Date(user.last_login_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : false;
  if (!hasRecentLogin && user.last_login_at) {
    issues.push("Inactive 30+ days");
  }

  const hasMultipleLockouts = (user.lockout_count || 0) > 3;
  if (hasMultipleLockouts) {
    issues.push(`${user.lockout_count} lockouts`);
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
