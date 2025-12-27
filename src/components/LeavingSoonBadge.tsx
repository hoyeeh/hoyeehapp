import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeavingSoonBadgeProps {
  expiresAt: string | null;
  className?: string;
  showDays?: boolean;
}

export function LeavingSoonBadge({ expiresAt, className, showDays = true }: LeavingSoonBadgeProps) {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Only show badge if within 30 days
  if (daysRemaining > 30 || daysRemaining < 0) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
        "bg-destructive/90 text-destructive-foreground backdrop-blur-sm",
        "animate-pulse",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {showDays ? (
        <span>Leaving in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
      ) : (
        <span>Leaving Soon</span>
      )}
    </div>
  );
}

export function getLifecycleStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'leaving_soon':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'hidden':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'kept':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getLifecycleStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'leaving_soon':
      return 'Leaving Soon';
    case 'hidden':
      return 'Hidden';
    case 'kept':
      return 'Kept';
    default:
      return status;
  }
}
