import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveOfflineSrc } from "@/services/unifiedOfflineVideo";
import { downloadKey } from "@/services/offlineStorage";

const posKey = (k: string) => `hoyeeh_offline_pos:${k}`;

/**
 * Local-only playback of a downloaded title. Never contacts the network,
 * so it works in airplane mode after a cold start. Seek works because the
 * whole verified file is served from a local Blob URL; position is saved
 * locally for resume.
 */
const OfflinePlayer = () => {
  const { contentId = "" } = useParams();
  const [params] = useSearchParams();
  const episodeId = params.get("episode") || undefined;
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const key = downloadKey(contentId, episodeId);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    resolveOfflineSrc(contentId, episodeId)
      .then((u) => {
        if (cancelled) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setSrc(u);
        setState(u ? "ready" : "missing");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [contentId, episodeId]);

  const onLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    const saved = Number(localStorage.getItem(posKey(key)) || 0);
    if (saved > 0 && saved < v.duration * 0.95) v.currentTime = saved;
  };
  const onTime = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    if (v.currentTime / v.duration >= 0.95) localStorage.removeItem(posKey(key));
    else localStorage.setItem(posKey(key), String(Math.floor(v.currentTime)));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="p-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/offline-downloads")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-muted-foreground">Playing from this device</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {state === "loading" && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
        {state === "missing" && (
          <div className="text-center px-6">
            <p className="font-medium mb-2">This download isn't available on this device.</p>
            <p className="text-sm text-muted-foreground mb-4">It may have expired, been removed, or belong to another profile.</p>
            <Button onClick={() => navigate("/offline-downloads")}>Back to downloads</Button>
          </div>
        )}
        {state === "ready" && src && (
          <video
            ref={videoRef}
            data-testid="offline-video"
            src={src}
            controls
            autoPlay
            playsInline
            className="w-full max-h-[80vh] bg-background"
            onLoadedMetadata={onLoaded}
            onTimeUpdate={onTime}
          />
        )}
      </div>
    </div>
  );
};

export default OfflinePlayer;
