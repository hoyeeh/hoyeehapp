import { AlertTriangle, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadExpiryWarningProps {
  expiresAt: number;
  variant?: "badge" | "card" | "inline";
  className?: string;
}

export function DownloadExpiryWarning({ 
  expiresAt, 
  variant = "badge",
  className 
}: DownloadExpiryWarningProps) {
  const now = Date.now();
  const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60));
  
  // Already expired
  if (daysLeft <= 0) {
    return variant === "badge" ? (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive",
        className
      )}>
        <AlertTriangle className="h-3 w-3" />
        Expired
      </span>
    ) : variant === "card" ? (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20",
        className
      )}>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div>
          <p className="font-medium text-sm text-destructive">Download Expired</p>
          <p className="text-xs text-muted-foreground">Re-download to watch offline</p>
        </div>
      </div>
    ) : (
      <span className={cn("text-destructive text-xs font-medium", className)}>
        Expired
      </span>
    );
  }
  
  // Warning states based on days remaining
  const isUrgent = daysLeft <= 1;
  const isWarning = daysLeft <= 3;
  const isNotice = daysLeft <= 7;
  
  const getTimeText = () => {
    if (hoursLeft < 24) {
      return `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} left`;
    }
    return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
  };
  
  const getColorClasses = () => {
    if (isUrgent) return {
      badge: "bg-destructive/20 text-destructive",
      card: "bg-destructive/10 border-destructive/20",
      icon: "text-destructive"
    };
    if (isWarning) return {
      badge: "bg-orange-500/20 text-orange-500",
      card: "bg-orange-500/10 border-orange-500/20",
      icon: "text-orange-500"
    };
    if (isNotice) return {
      badge: "bg-yellow-500/20 text-yellow-500",
      card: "bg-yellow-500/10 border-yellow-500/20",
      icon: "text-yellow-500"
    };
    return {
      badge: "bg-muted text-muted-foreground",
      card: "bg-muted/50 border-border",
      icon: "text-muted-foreground"
    };
  };
  
  const colors = getColorClasses();
  
  if (variant === "badge") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        colors.badge,
        className
      )}>
        <Clock className="h-3 w-3" />
        {getTimeText()}
      </span>
    );
  }
  
  if (variant === "card") {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg border",
        colors.card,
        className
      )}>
        <Calendar className={cn("h-5 w-5", colors.icon)} />
        <div>
          <p className={cn("font-medium text-sm", colors.icon)}>
            {isUrgent ? "Expiring Soon!" : isWarning ? "Expiring in " + daysLeft + " days" : "Available offline"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isUrgent 
              ? `Only ${getTimeText()} to watch` 
              : isWarning 
              ? "Download will expire soon"
              : `${getTimeText()} remaining`
            }
          </p>
        </div>
      </div>
    );
  }
  
  // Inline variant
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs",
      colors.icon,
      className
    )}>
      <Clock className="h-3 w-3" />
      {getTimeText()}
    </span>
  );
}

// Helper to calculate days until expiry
export function getDaysUntilExpiry(expiresAt: number): number {
  return Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
}

// Helper to check if download is expiring soon (within 7 days)
export function isExpiringSoon(expiresAt: number): boolean {
  return getDaysUntilExpiry(expiresAt) <= 7;
}

// Helper to check if download is expired
export function isExpired(expiresAt: number): boolean {
  return expiresAt <= Date.now();
}
