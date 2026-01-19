import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Users,
  Mail,
  Phone,
  Lock,
  CreditCard,
  Clock
} from "lucide-react";
import { UserProfile, UserHealthStatus, calculateHealthStatus } from "./UserDetailsCard";

interface UserHealthAuditProps {
  users: UserProfile[];
  authEmails: Map<string, string>;
  onRunAudit: () => void;
  isRunning: boolean;
}

interface AuditSummary {
  totalUsers: number;
  healthyUsers: number;
  warningUsers: number;
  criticalUsers: number;
  missingEmails: number;
  missingPhones: number;
  lockedAccounts: number;
  expiredSubscriptions: number;
  inactiveUsers: number;
  multiLockoutUsers: number;
}

export const UserHealthAudit = ({ users, authEmails, onRunAudit, isRunning }: UserHealthAuditProps) => {
  const [auditResults, setAuditResults] = useState<{
    summary: AuditSummary;
    userHealthMap: Map<string, UserHealthStatus>;
  } | null>(null);

  const runAudit = () => {
    onRunAudit();
    
    const summary: AuditSummary = {
      totalUsers: users.length,
      healthyUsers: 0,
      warningUsers: 0,
      criticalUsers: 0,
      missingEmails: 0,
      missingPhones: 0,
      lockedAccounts: 0,
      expiredSubscriptions: 0,
      inactiveUsers: 0,
      multiLockoutUsers: 0
    };

    const userHealthMap = new Map<string, UserHealthStatus>();

    users.forEach(user => {
      const authEmail = authEmails.get(user.id);
      const health = calculateHealthStatus(user, authEmail);
      userHealthMap.set(user.id, health);

      switch (health.overallHealth) {
        case 'good':
          summary.healthyUsers++;
          break;
        case 'warning':
          summary.warningUsers++;
          break;
        case 'critical':
          summary.criticalUsers++;
          break;
      }

      if (!health.hasEmail) summary.missingEmails++;
      if (!health.hasPhone) summary.missingPhones++;
      if (health.isAccountLocked) summary.lockedAccounts++;
      if (health.isSubscriptionExpired) summary.expiredSubscriptions++;
      if (!health.hasRecentLogin) summary.inactiveUsers++;
      if (health.hasMultipleLockouts) summary.multiLockoutUsers++;
    });

    setAuditResults({ summary, userHealthMap });
  };

  const getHealthPercentage = () => {
    if (!auditResults) return 0;
    return Math.round((auditResults.summary.healthyUsers / auditResults.summary.totalUsers) * 100);
  };

  const getCriticalUsers = () => {
    if (!auditResults) return [];
    return users.filter(u => auditResults.userHealthMap.get(u.id)?.overallHealth === 'critical');
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            User Health Audit
          </CardTitle>
          <Button 
            variant="brand" 
            size="sm" 
            onClick={runAudit}
            disabled={isRunning}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? "Running..." : "Run Audit"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!auditResults ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Click "Run Audit" to check the health of all user accounts</p>
            <p className="text-sm mt-1">This will analyze {users.length} users</p>
          </div>
        ) : (
          <>
            {/* Health Score */}
            <div className="p-4 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Health Score</span>
                <span className="text-2xl font-bold text-primary">{getHealthPercentage()}%</span>
              </div>
              <Progress value={getHealthPercentage()} className="h-3" />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard 
                icon={<Users className="h-4 w-4" />}
                label="Total Users"
                value={auditResults.summary.totalUsers}
                variant="default"
              />
              <StatCard 
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Healthy"
                value={auditResults.summary.healthyUsers}
                variant="success"
              />
              <StatCard 
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Warnings"
                value={auditResults.summary.warningUsers}
                variant="warning"
              />
              <StatCard 
                icon={<XCircle className="h-4 w-4" />}
                label="Critical"
                value={auditResults.summary.criticalUsers}
                variant="danger"
              />
              <StatCard 
                icon={<Mail className="h-4 w-4" />}
                label="Missing Email"
                value={auditResults.summary.missingEmails}
                variant={auditResults.summary.missingEmails > 0 ? "danger" : "default"}
              />
              <StatCard 
                icon={<Phone className="h-4 w-4" />}
                label="Missing Phone"
                value={auditResults.summary.missingPhones}
                variant={auditResults.summary.missingPhones > 0 ? "warning" : "default"}
              />
              <StatCard 
                icon={<Lock className="h-4 w-4" />}
                label="Locked"
                value={auditResults.summary.lockedAccounts}
                variant={auditResults.summary.lockedAccounts > 0 ? "danger" : "default"}
              />
              <StatCard 
                icon={<CreditCard className="h-4 w-4" />}
                label="Expired Subs"
                value={auditResults.summary.expiredSubscriptions}
                variant={auditResults.summary.expiredSubscriptions > 0 ? "warning" : "default"}
              />
              <StatCard 
                icon={<Clock className="h-4 w-4" />}
                label="Inactive (30d)"
                value={auditResults.summary.inactiveUsers}
                variant="default"
              />
            </div>

            {/* Critical Users List */}
            {getCriticalUsers().length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Critical Issues ({getCriticalUsers().length})
                </h4>
                <ScrollArea className="h-40 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <div className="space-y-2">
                    {getCriticalUsers().map(user => {
                      const health = auditResults.userHealthMap.get(user.id);
                      return (
                        <div key={user.id} className="flex items-center justify-between p-2 bg-background/50 rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-xs font-bold">
                              {user.display_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{user.display_name || "Unknown User"}</p>
                              <p className="text-xs text-muted-foreground">{health?.issues[0]}</p>
                            </div>
                          </div>
                          <Badge className="bg-red-500/20 text-red-400">Critical</Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const StatCard = ({ 
  icon, 
  label, 
  value, 
  variant 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  variant: 'default' | 'success' | 'warning' | 'danger';
}) => {
  const variantClasses = {
    default: "bg-secondary/50 text-foreground",
    success: "bg-green-500/10 text-green-400",
    warning: "bg-yellow-500/10 text-yellow-400",
    danger: "bg-red-500/10 text-red-400"
  };

  return (
    <div className={`p-3 rounded-lg ${variantClasses[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
};
