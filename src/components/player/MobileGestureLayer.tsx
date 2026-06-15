import { useEffect, useRef, useState } from "react";
import type Player from "video.js/dist/types/player";
import { Volume2, Sun, FastForward, Rewind } from "lucide-react";

/**
 * Phase 4 — mobile swipe gestures for the main full-length VJS player.
 *
 * Behavior:
 *   - Right half, vertical swipe → volume 0-100%
 *   - Left half, vertical swipe → brightness (CSS filter; web cannot touch HW)
 *   - Horizontal swipe → seek ±10s (proportional to drag distance)
 *   - Tap (no movement) → toggle play/pause + show native controls
 *
 * Constraints honored:
 *   - Does NOT overlap the native VJS control bar (bottom 64px excluded).
 *   - Does NOT overlap top-right native Cast / AirPlay buttons (top 56px right gap).
 *   - Cleans up touch listeners + animation frames on unmount.
 */

const SEEK_STEP_SECONDS = 10;
const SEEK_FULL_TRAVEL_PX = 240; // dragging this far = full ±10s
const VOL_FULL_TRAVEL_PX = 200;
const BRIGHT_FULL_TRAVEL_PX = 200;
const TAP_MOVE_THRESHOLD = 8;
const TAP_TIME_THRESHOLD = 250;
const INDICATOR_HIDE_MS = 700;
const CONTROL_BAR_RESERVED_PX = 64;
const TOP_RIGHT_RESERVED_PX = 56;

type GestureKind = "volume" | "brightness" | "seek" | null;

interface Props {
  getPlayer: () => Player | null;
  getVideoElement: () => HTMLVideoElement | null;
  /** Persisted brightness state lives in the parent so it survives re-renders. */
  brightness: number;
  setBrightness: (v: number) => void;
}

export function MobileGestureLayer({ getPlayer, getVideoElement, brightness, setBrightness }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [indicator, setIndicator] = useState<{
    kind: GestureKind;
    value: number; // 0-1 for vol/bright; seconds delta for seek
  } | null>(null);

  // Mutable gesture state — refs to avoid re-renders during the swipe.
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    kind: null as GestureKind,
    half: "right" as "left" | "right",
    startVolume: 0,
    startBrightness: 1,
    startCurrentTime: 0,
    seekDelta: 0,
    width: 0,
  });

  // Apply brightness CSS filter to the underlying <video>.
  useEffect(() => {
    const v = getVideoElement();
    if (!v) return;
    v.style.filter = `brightness(${brightness})`;
    return () => {
      if (v) v.style.filter = "";
    };
  }, [brightness, getVideoElement]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    let hideTimer: number | null = null;
    const scheduleHide = () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setIndicator(null), INDICATOR_HIDE_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      const player = getPlayer();
      const s = stateRef.current;
      s.startX = t.clientX;
      s.startY = t.clientY;
      s.startTime = Date.now();
      s.kind = null;
      s.half = t.clientX - rect.left < rect.width / 2 ? "left" : "right";
      s.width = rect.width;
      s.startVolume = player ? Number(player.volume() ?? 1) : 1;
      s.startBrightness = brightness;
      s.startCurrentTime = player ? Number(player.currentTime() ?? 0) : 0;
      s.seekDelta = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const s = stateRef.current;
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;

      // Lock gesture axis on first decisive movement.
      if (!s.kind) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          s.kind = "seek";
        } else {
          s.kind = s.half === "right" ? "volume" : "brightness";
        }
      }

      // Prevent page scroll while gesturing.
      if (e.cancelable) e.preventDefault();

      const player = getPlayer();
      if (!player) return;

      if (s.kind === "volume") {
        const next = Math.min(1, Math.max(0, s.startVolume + -dy / VOL_FULL_TRAVEL_PX));
        player.volume(next);
        if (next > 0) player.muted(false);
        setIndicator({ kind: "volume", value: next });
      } else if (s.kind === "brightness") {
        // Range 0.3 - 1.5 (don't go fully black; allow slight boost)
        const next = Math.min(1.5, Math.max(0.3, s.startBrightness + -dy / BRIGHT_FULL_TRAVEL_PX));
        setBrightness(next);
        setIndicator({ kind: "brightness", value: (next - 0.3) / 1.2 });
      } else if (s.kind === "seek") {
        const ratio = Math.max(-1, Math.min(1, dx / SEEK_FULL_TRAVEL_PX));
        s.seekDelta = ratio * SEEK_STEP_SECONDS;
        setIndicator({ kind: "seek", value: s.seekDelta });
      }
    };

    const onTouchEnd = (_e: TouchEvent) => {
      const s = stateRef.current;
      const dt = Date.now() - s.startTime;
      const dx = Math.abs(s.seekDelta);
      const player = getPlayer();

      if (s.kind === "seek" && player) {
        const dur = Number(player.duration() ?? 0) || Infinity;
        const next = Math.max(0, Math.min(dur, s.startCurrentTime + s.seekDelta));
        player.currentTime(next);
        scheduleHide();
      } else if (s.kind) {
        scheduleHide();
      } else if (dt < TAP_TIME_THRESHOLD && dx < TAP_MOVE_THRESHOLD && player) {
        // Tap → toggle play/pause + wake controls (matches native VJS click behavior).
        if (player.paused()) {
          const p = player.play();
          if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
        } else {
          player.pause();
        }
        (player as any).userActive?.(true);
      }

      s.kind = null;
      s.seekDelta = 0;
    };

    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("touchstart", onTouchStart, opts);
    el.addEventListener("touchmove", onTouchMove, opts);
    el.addEventListener("touchend", onTouchEnd, opts);
    el.addEventListener("touchcancel", onTouchEnd, opts);

    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [getPlayer, getVideoElement, brightness, setBrightness]);

  return (
    <>
      {/* Gesture surface — sits ABOVE the video, BELOW native controls / cast buttons.
          Excludes bottom control bar (~64px) and top-right cast buttons. */}
      <div
        ref={overlayRef}
        aria-hidden
        className="absolute left-0 z-[5] touch-none select-none"
        style={{
          top: 0,
          right: TOP_RIGHT_RESERVED_PX,
          bottom: CONTROL_BAR_RESERVED_PX,
        }}
      />
      <div
        ref={(node) => {
          // Same listeners aren't needed on the right-of-cast strip; this just fills the
          // bottom-right corner of the gesture zone to the edge below the cast buttons.
          if (!node) return;
        }}
        aria-hidden
        className="absolute right-0 z-[5] touch-none select-none"
        style={{
          top: TOP_RIGHT_RESERVED_PX,
          width: TOP_RIGHT_RESERVED_PX,
          bottom: CONTROL_BAR_RESERVED_PX,
        }}
      />

      {/* Indicator */}
      {indicator && (
        <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl bg-background/80 px-4 py-3 text-foreground shadow-lg backdrop-blur-sm">
            {indicator.kind === "volume" && <Volume2 className="h-6 w-6" />}
            {indicator.kind === "brightness" && <Sun className="h-6 w-6" />}
            {indicator.kind === "seek" && (indicator.value >= 0 ? <FastForward className="h-6 w-6" /> : <Rewind className="h-6 w-6" />)}
            <span className="font-medium tabular-nums">
              {indicator.kind === "seek"
                ? `${indicator.value >= 0 ? "+" : ""}${indicator.value.toFixed(1)}s`
                : `${Math.round(indicator.value * 100)}%`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileGestureLayer;
