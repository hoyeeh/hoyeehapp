import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import { Loader2, AlertCircle, Cast, Airplay } from "lucide-react";
import { savePlaybackPosition, getPlaybackPosition } from "@/lib/playbackStorage";

type VideoJsOptions = NonNullable<Parameters<typeof videojs>[1]>;

interface VideoJSPlayerProps {
  options: VideoJsOptions;
  onReady?: (player: Player) => void;
  /** Called with the underlying <video> element once mounted. Use for Watch Party sync. */
  onVideoElement?: (el: HTMLVideoElement | null) => void;
  /** Enable IndexedDB resume via playbackStorage. */
  resume?: {
    contentId: string;
    episodeId?: string;
    title?: string;
    thumbnail?: string;
    /** Min seconds before we start persisting (default 60s, matches existing logic). */
    minSecondsBeforeSave?: number;
    /** Treat as completed at this ratio (default 0.95) — clears the saved position. */
    completionRatio?: number;
  };
  className?: string;
}

export interface VideoJSPlayerHandle {
  getPlayer: () => Player | null;
  getVideoElement: () => HTMLVideoElement | null;
}

export const VideoJSPlayer = forwardRef<VideoJSPlayerHandle, VideoJSPlayerProps>(
  function VideoJSPlayer({ options, onReady, onVideoElement, resume, className }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<Player | null>(null);
    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const resumeAppliedRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canAirPlay, setCanAirPlay] = useState(false);
    const [canRemote, setCanRemote] = useState(false);

    useImperativeHandle(ref, () => ({
      getPlayer: () => playerRef.current,
      getVideoElement: () => videoElRef.current,
    }));

    // Init player once
    useEffect(() => {
      if (!containerRef.current || playerRef.current) return;

      const videoEl = document.createElement("video-js");
      videoEl.classList.add("vjs-big-play-centered");
      containerRef.current.appendChild(videoEl);

      const player = videojs(
        videoEl,
        {
          controls: true,
          responsive: true,
          fluid: true,
          preload: "metadata",
          ...options,
          html5: {
            ...(options.html5 ?? {}),
            vhs: { overrideNative: false, ...((options.html5 as any)?.vhs ?? {}) },
          },
        },
        () => {
          // Underlying HTMLVideoElement (Video.js replaces the <video-js> custom el)
          const htmlVideo = player.el().querySelector("video") as HTMLVideoElement | null;
          if (htmlVideo) {
            // CORS for DigitalOcean Spaces (required for native cast / canvas / etc.)
            htmlVideo.setAttribute("crossorigin", "anonymous");
            htmlVideo.setAttribute("playsinline", "");
            videoElRef.current = htmlVideo;
            onVideoElement?.(htmlVideo);

            // Native cast capability detection
            const remote = (htmlVideo as any).remote;
            setCanRemote(Boolean(remote?.prompt));
            setCanAirPlay(typeof (htmlVideo as any).webkitShowPlaybackTargetPicker === "function");
          }
          onReady?.(player);
        }
      );
      playerRef.current = player;

      player.on("waiting", () => setIsLoading(true));
      player.on("loadstart", () => {
        setIsLoading(true);
        setError(null);
      });
      player.on("canplay", () => setIsLoading(false));
      player.on("playing", () => setIsLoading(false));
      player.on("error", () => {
        const e = player.error();
        setIsLoading(false);
        setError(e?.message || "Something went wrong playing this video.");
      });

      return () => {
        onVideoElement?.(null);
        videoElRef.current = null;
        if (playerRef.current && !playerRef.current.isDisposed()) {
          playerRef.current.dispose();
        }
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update sources when they change (without recreating the player)
    useEffect(() => {
      const player = playerRef.current;
      if (!player) return;
      if (options.sources) {
        resumeAppliedRef.current = false;
        setError(null);
        setIsLoading(true);
        player.src(options.sources);
      }
      if (options.autoplay !== undefined) player.autoplay(options.autoplay);
    }, [options.sources, options.autoplay]);

    // Resume from playbackStorage
    useEffect(() => {
      if (!resume) return;
      const player = playerRef.current;
      if (!player) return;

      const handleLoaded = async () => {
        if (resumeAppliedRef.current) return;
        try {
          const saved = await getPlaybackPosition(resume.contentId, resume.episodeId);
          if (saved && saved.position > 5) {
            const dur = player.duration() || saved.duration;
            // Skip if essentially finished
            const ratio = resume.completionRatio ?? 0.95;
            if (!dur || saved.position / dur < ratio) {
              player.currentTime(saved.position);
            }
          }
        } catch (e) {
          console.warn("[VideoJSPlayer] resume failed:", e);
        } finally {
          resumeAppliedRef.current = true;
        }
      };

      player.on("loadedmetadata", handleLoaded);
      return () => {
        player.off("loadedmetadata", handleLoaded);
      };
    }, [resume?.contentId, resume?.episodeId]);

    // Persist progress
    useEffect(() => {
      if (!resume) return;
      const player = playerRef.current;
      if (!player) return;

      const minSecs = resume.minSecondsBeforeSave ?? 60;
      const completionRatio = resume.completionRatio ?? 0.95;
      let lastSaved = 0;

      const handleTimeUpdate = () => {
        const t = player.currentTime() ?? 0;
        const d = player.duration() ?? 0;
        if (!d) return;
        if (t < minSecs) return;
        const now = Date.now();
        if (now - lastSaved < 5000) return;
        lastSaved = now;

        if (t / d >= completionRatio) {
          // Mark as complete — clear by saving 0/duration is up to caller; we save final pos.
          savePlaybackPosition(resume.contentId, t, d, {
            episodeId: resume.episodeId,
            title: resume.title,
            thumbnail: resume.thumbnail,
          });
          return;
        }
        savePlaybackPosition(resume.contentId, t, d, {
          episodeId: resume.episodeId,
          title: resume.title,
          thumbnail: resume.thumbnail,
        });
      };

      player.on("timeupdate", handleTimeUpdate);
      return () => {
        player.off("timeupdate", handleTimeUpdate);
      };
    }, [resume?.contentId, resume?.episodeId, resume?.title, resume?.thumbnail]);

    // Native cast handlers
    const handleChromecast = useCallback(() => {
      const v = videoElRef.current as any;
      v?.remote?.prompt?.().catch((e: any) => console.warn("[Cast] prompt failed:", e));
    }, []);

    const handleAirPlay = useCallback(() => {
      const v = videoElRef.current as any;
      v?.webkitShowPlaybackTargetPicker?.();
    }, []);

    return (
      <div data-vjs-player className={className} style={{ position: "relative" }}>
        <div ref={containerRef} />

        {/* Loading overlay */}
        {isLoading && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 z-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 text-center p-6 z-20">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-foreground font-medium">Playback error</p>
            <p className="text-muted-foreground text-sm max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => {
                const player = playerRef.current;
                if (!player) return;
                setError(null);
                setIsLoading(true);
                if (options.sources) player.src(options.sources);
                player.load();
              }}
              className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {/* Native cast buttons */}
        {(canRemote || canAirPlay) && (
          <div className="absolute top-3 right-3 z-30 flex gap-2">
            {canRemote && (
              <button
                type="button"
                aria-label="Cast to device"
                onClick={handleChromecast}
                className="p-2 rounded-md bg-background/70 hover:bg-background text-foreground"
              >
                <Cast className="h-5 w-5" />
              </button>
            )}
            {canAirPlay && (
              <button
                type="button"
                aria-label="AirPlay"
                onClick={handleAirPlay}
                className="p-2 rounded-md bg-background/70 hover:bg-background text-foreground"
              >
                <Airplay className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default VideoJSPlayer;
