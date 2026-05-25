import { AlertTriangle, RefreshCw, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CastFailureBannerProps {
  /** Human-readable last error message from the TV / network. */
  error: string;
  /** Retry sending the LOAD to the already-paired TV. */
  onRetry: () => void;
  /** Open the pairing dialog again (a.k.a. "resend pairing code"). */
  onResendPairing: () => void;
  /** Whether a retry is in-flight. */
  busy?: boolean;
  className?: string;
}

/**
 * Renders the clear "TV failed to load" status with retry + last error
 * message after QR-code pairing succeeds but the auto-launch never
 * receives an ack from the receiver.
 */
export function CastFailureBanner({
  error,
  onRetry,
  onResendPairing,
  busy = false,
  className,
}: CastFailureBannerProps) {
  return (
    <div
      role="alert"
      data-testid="cast-failure-banner"
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-sm",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
        <div className="space-y-1">
          <p className="font-medium text-destructive">TV failed to load</p>
          <p className="text-xs text-muted-foreground break-words">
            {error || "The TV did not confirm playback in time."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="default"
          onClick={onRetry}
          disabled={busy}
          className="gap-1"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", busy && "animate-spin")}
          />
          {busy ? "Retrying…" : "Retry"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onResendPairing}
          disabled={busy}
          className="gap-1"
        >
          <QrCode className="h-3.5 w-3.5" />
          Resend pairing code
        </Button>
      </div>
    </div>
  );
}
