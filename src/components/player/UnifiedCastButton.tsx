import { useEffect, useState, useCallback } from "react";
import { Cast, Airplay } from "lucide-react";
import { toast } from "sonner";

interface UnifiedCastButtonProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  title?: string;
  poster?: string;
  /** Optional override for positioning. Defaults to absolute top-right overlay. */
  className?: string;
}

const isUserCancel = (e: any) =>
  e?.name === "NotAllowedError" || e?.name === "AbortError";

/**
 * Single, lightweight cast launcher used by BOTH the legacy <VideoPlayer />
 * and the new <VideoJSPlayer />. Renders Chromecast and/or AirPlay buttons
 * only when the underlying <video> element exposes the native APIs.
 *
 * Native HTML5 only — no SDK, no extra deps. Sits above the video, but
 * positioned in the top-right corner so it doesn't collide with the
 * mobile gesture swipe zones (left/right thirds of the player surface).
 */
export function UnifiedCastButton({ videoRef, title, poster, className }: UnifiedCastButtonProps) {
  const [canRemote, setCanRemote] = useState(false);
  const [canAirPlay, setCanAirPlay] = useState(false);

  // Probe capabilities once the video element is available. Re-probe shortly
  // after mount because some platforms expose `remote` asynchronously.
  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      const v = videoRef.current as any;
      if (!v || cancelled) return;
      setCanRemote(Boolean(v.remote && typeof v.remote.prompt === "function"));
      setCanAirPlay(typeof v.webkitShowPlaybackTargetPicker === "function");
    };
    probe();
    const t = setTimeout(probe, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [videoRef]);

  // Keep TV metadata fresh on the underlying element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (poster) v.setAttribute("poster", poster);
    if (title) v.setAttribute("title", title);
  }, [videoRef, poster, title]);

  const handleChromecast = useCallback(() => {
    const v = videoRef.current as any;
    if (!v?.remote?.prompt) {
      toast.error("Casting failed. Please check your network or try again.");
      return;
    }
    try {
      const r = v.remote.prompt();
      if (r && typeof r.catch === "function") {
        r.catch((e: any) => {
          if (isUserCancel(e)) return;
          console.warn("[UnifiedCast] Chromecast prompt failed:", e);
          toast.error("Casting failed. Please check your network or try again.");
        });
      }
    } catch (e: any) {
      if (isUserCancel(e)) return;
      console.warn("[UnifiedCast] Chromecast prompt threw:", e);
      toast.error("Casting failed. Please check your network or try again.");
    }
  }, [videoRef]);

  const handleAirPlay = useCallback(() => {
    const v = videoRef.current as any;
    if (typeof v?.webkitShowPlaybackTargetPicker !== "function") {
      toast.error("Casting failed. Please check your network or try again.");
      return;
    }
    try {
      v.webkitShowPlaybackTargetPicker();
    } catch (e: any) {
      if (isUserCancel(e)) return;
      console.warn("[UnifiedCast] AirPlay picker failed:", e);
      toast.error("Casting failed. Please check your network or try again.");
    }
  }, [videoRef]);

  if (!canRemote && !canAirPlay) return null;

  return (
    <div
      className={
        className ??
        "absolute top-3 right-3 z-40 flex gap-2 pointer-events-auto"
      }
    >
      {canRemote && (
        <button
          type="button"
          aria-label="Cast to device"
          onClick={handleChromecast}
          className="p-2 rounded-md bg-background/70 hover:bg-background text-foreground backdrop-blur-sm transition-colors"
        >
          <Cast className="h-5 w-5" />
        </button>
      )}
      {canAirPlay && (
        <button
          type="button"
          aria-label="AirPlay"
          onClick={handleAirPlay}
          className="p-2 rounded-md bg-background/70 hover:bg-background text-foreground backdrop-blur-sm transition-colors"
        >
          <Airplay className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export default UnifiedCastButton;
