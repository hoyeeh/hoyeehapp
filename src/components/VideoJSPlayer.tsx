import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

type VideoJsOptions = NonNullable<Parameters<typeof videojs>[1]>;

interface VideoJSPlayerProps {
  options: VideoJsOptions;
  onReady?: (player: Player) => void;
  className?: string;
}

export function VideoJSPlayer({ options, onReady, className }: VideoJSPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  // Initialize / re-initialize when sources change
  useEffect(() => {
    if (!containerRef.current) return;

    if (!playerRef.current) {
      const videoEl = document.createElement("video-js");
      videoEl.classList.add("vjs-big-play-centered");
      containerRef.current.appendChild(videoEl);

      const player = (playerRef.current = videojs(videoEl, options, () => {
        onReady?.(player);
      }));
    } else {
      const player = playerRef.current;
      if (options.autoplay !== undefined) player.autoplay(options.autoplay);
      if (options.sources) player.src(options.sources);
    }
  }, [options, onReady]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className={className}>
      <div ref={containerRef} />
    </div>
  );
}

export default VideoJSPlayer;
