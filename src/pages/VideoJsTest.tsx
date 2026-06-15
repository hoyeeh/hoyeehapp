import { useEffect, useMemo, useRef, useState } from "react";
import { VideoJSPlayer } from "@/components/VideoJSPlayer";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Phase 1 isolated test route for the new Video.js-based player.
 *
 * Strict Phase 1 scope:
 *  - Standard MP4 only (no HLS, no DRM, no quality selector plugin)
 *  - crossOrigin="anonymous" for DigitalOcean Spaces
 *  - Loading + error states (handled inside VideoJSPlayer)
 *  - Resume via existing playbackStorage (IndexedDB)
 *  - Native HTML5 Cast (video.remote.prompt) + AirPlay (webkitShowPlaybackTargetPicker)
 *  - Full Watch Party parity (host pushes, guest syncs, start_playback broadcast)
 *
 * Deferred to later phases: Widevine EME, mobile gestures, right-click guard,
 * persistent mini-player wiring.
 */
export default function VideoJsTest() {
  // Sample test source — replace via ?src= query for ad-hoc testing.
  const params = new URLSearchParams(window.location.search);
  const src =
    params.get("src") ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const contentId = params.get("contentId") || "videojs-test-sample";

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const initialPartySyncDoneRef = useRef(false);
  const lastPartySyncRef = useRef(0);

  const {
    party,
    isHost,
    isWatchPartyGuest,
    syncToParty,
    updatePlayback,
  } = useWatchPartyContext();

  const options = useMemo(
    () => ({
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata" as const,
      sources: [{ src, type: "video/mp4" }],
    }),
    [src]
  );

  // ---- Watch Party: guest sync to party state ----
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const forceSync = !initialPartySyncDoneRef.current;
    syncToParty(videoEl, forceSync);
    initialPartySyncDoneRef.current = true;
  }, [party?.playback_time, party?.is_playing, isHost, syncToParty, videoEl]);

  // ---- Watch Party: guest periodic drift correction ----
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const id = setInterval(() => syncToParty(videoEl, false), 5000);
    return () => clearInterval(id);
  }, [party, isHost, syncToParty, videoEl]);

  // ---- Watch Party: guest listens for start_playback broadcast ----
  useEffect(() => {
    if (!party || isHost || !videoEl) return;
    const channel = supabase
      .channel(`watch-party-reactions-${party.id}`)
      .on("broadcast", { event: "start_playback" }, () => {
        videoEl.currentTime = 0;
        videoEl.play().catch(console.error);
        toast.success("🎬 Playback started!", { duration: 3000 });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id, isHost, videoEl]);

  // ---- Watch Party: host broadcasts playback updates ----
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
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Video.js Test Player (Phase 1)</h1>
          <p className="text-sm text-muted-foreground">
            Isolated MP4 playback sandbox. Pass <code>?src=</code> and{" "}
            <code>?contentId=</code> to test other sources. Watch Party sync, resume,
            and native cast are active here.
          </p>
        </header>

        <VideoJSPlayer
          options={options}
          onVideoElement={setVideoEl}
          resume={{ contentId, title: "Video.js test" }}
          className="rounded-lg overflow-hidden shadow-lg"
        />

        <div className="text-xs text-muted-foreground space-y-1">
          <div>Source: <span className="break-all">{src}</span></div>
          {party && (
            <div>
              Watch Party: <strong>{party.party_code}</strong> · role:{" "}
              {isHost ? "host" : isWatchPartyGuest ? "guest" : "—"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
