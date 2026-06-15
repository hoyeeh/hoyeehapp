import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoJSPlayer } from "@/components/VideoJSPlayer";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";
import { useMiniPlayer } from "@/contexts/MiniPlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Content } from "@/types";

interface Props {
  src: string;
  type?: string;
  poster?: string;
  autoplay?: boolean;
  contentId: string;
  episodeId?: string;
  title?: string;
  thumbnail?: string;
  className?: string;
  /**
   * When provided, on unmount the player will hand off its final {src, currentTime}
   * to the persistent MiniPlayer so playback continues while navigating away.
   * The MiniPlayer remains a plain <video> tag — we only pass it state.
   */
  miniPlayerContent?: Content;
}

/**
 * Phase 2 wrapper: VideoJSPlayer + full Watch Party parity (host pushes,
 * guest syncs, start_playback broadcast, drift correction) + playbackStorage
 * resume. Designed to drop into surfaces that previously used <VideoPlayer />.
 *
 * Cast surface here is Phase-1 native HTML5 only (already inside VideoJSPlayer).
 * The legacy CastContext is intentionally NOT wired in this phase.
 */
export function VideoJSPlayerWithWatchParty({
  src,
  type = "video/mp4",
  poster,
  autoplay,
  contentId,
  episodeId,
  title,
  thumbnail,
  className,
  miniPlayerContent,
}: Props) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const initialPartySyncDoneRef = useRef(false);
  const lastPartySyncRef = useRef(0);
  // Step 4 — when native casting is active, the TV owns the timeline.
  // Suspend guest→host seek sync and host→guest broadcasts to avoid fights.
  const [nativeCastActive, setNativeCastActive] = useState(false);
  const nativeCastActiveRef = useRef(false);
  useEffect(() => { nativeCastActiveRef.current = nativeCastActive; }, [nativeCastActive]);
  const { minimize } = useMiniPlayer();

  // Hand off final state to the persistent MiniPlayer just before VJS disposes.
  // Skipped during an active Watch Party (host/guest sync owns that lifecycle)
  // and when no content was provided.
  const handleBeforeDispose = useCallback(
    (snap: { currentTime: number; duration: number; src: string | null; paused: boolean }) => {
      if (!miniPlayerContent) return;
      if (party) return;
      if (!snap.src) return;
      if (snap.duration > 0 && snap.currentTime / snap.duration >= 0.95) return; // finished
      if (snap.currentTime < 5) return; // not enough watched to bother
      minimize(miniPlayerContent, snap.src, snap.currentTime, snap.duration);
    },
    [miniPlayerContent, party, minimize]
  );

  const options = useMemo(
    () => ({
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata" as const,
      autoplay: autoplay ?? false,
      poster,
      sources: [{ src, type }],
    }),
    [src, type, poster, autoplay]
  );

  // Guest: sync to party state on change
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const forceSync = !initialPartySyncDoneRef.current;
    syncToParty(videoEl, forceSync);
    initialPartySyncDoneRef.current = true;
  }, [party?.playback_time, party?.is_playing, isHost, syncToParty, videoEl]);

  // Guest: periodic drift correction
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const id = setInterval(() => syncToParty(videoEl, false), 5000);
    return () => clearInterval(id);
  }, [party, isHost, syncToParty, videoEl]);

  // Guest: listen for host start_playback broadcast
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const channel = supabase
      .channel(`watch-party-reactions-${party.id}`)
      .on("broadcast", { event: "start_playback" }, () => {
        videoEl.currentTime = 0;
        videoEl.play().catch((e) => console.error("[WP] start_playback failed", e));
        toast.success("🎬 Playback started!", { duration: 3000 });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id, isHost, videoEl]);

  // Host: broadcast playback updates (throttled 2s on timeupdate, immediate on play/pause/seek)
  useEffect(() => {
    if (!party || !isHost || !videoEl) return;

    const onTime = () => {
      const now = Date.now();
      if (now - lastPartySyncRef.current >= 2000) {
        lastPartySyncRef.current = now;
        updatePlayback(videoEl.currentTime, !videoEl.paused);
      }
    };
    const onPlayPause = () => updatePlayback(videoEl.currentTime, !videoEl.paused);
    const onSeeked = () => updatePlayback(videoEl.currentTime, !videoEl.paused);

    videoEl.addEventListener("timeupdate", onTime);
    videoEl.addEventListener("play", onPlayPause);
    videoEl.addEventListener("pause", onPlayPause);
    videoEl.addEventListener("seeked", onSeeked);
    return () => {
      videoEl.removeEventListener("timeupdate", onTime);
      videoEl.removeEventListener("play", onPlayPause);
      videoEl.removeEventListener("pause", onPlayPause);
      videoEl.removeEventListener("seeked", onSeeked);
    };
  }, [party, isHost, updatePlayback, videoEl]);

  return (
    <VideoJSPlayer
      options={options}
      onVideoElement={setVideoEl}
      resume={{ contentId, episodeId, title, thumbnail }}
      onBeforeDispose={handleBeforeDispose}
      enableMobileGestures
      poster={poster ?? thumbnail}
      title={title}
      className={className}
    />
  );
}

export default VideoJSPlayerWithWatchParty;
