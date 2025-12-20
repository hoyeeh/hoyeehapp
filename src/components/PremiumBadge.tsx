import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export const PremiumBadge = ({ size = "md", showText = true, className }: PremiumBadgeProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const paddingSizes = {
    sm: "px-1.5 py-0.5",
    md: "px-2 py-1",
    lg: "px-3 py-1.5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold",
        paddingSizes[size],
        className
      )}
    >
      <Crown className={sizeClasses[size]} />
    </div>
  );
};

interface ContentLockOverlayProps {
  onSubscribe?: () => void;
}

export const ContentLockOverlay = ({ onSubscribe }: ContentLockOverlayProps) => {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-10 rounded-lg">
      <Crown className="h-12 w-12 text-amber-500 mb-3" />
      <h3 className="text-lg font-semibold text-white mb-1">Subscription Required</h3>
      <p className="text-sm text-gray-300 mb-4 max-w-xs">
        Subscribe to unlock this and all premium content
      </p>
      {onSubscribe && (
        <button
          onClick={onSubscribe}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Subscribe Now
        </button>
      )}
    </div>
  );
};
