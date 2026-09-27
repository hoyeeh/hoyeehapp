import { useEffect, useRef, useState, type FormEvent } from "react";
import { Tv, Loader2, QrCode, AlertCircle, Unplug, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCast } from "@/contexts/CastContext";
import type { CastDevice } from "@/hooks/useUniversalCast";
import { MobileQRScanner } from "./MobileQRScanner";

/**
 * Mobile "Cast to TV" popup. ONE transport only: the Hoyeeh TV-code receiver
 * (hoyeeh.com/tv) over cast-signaling v2 via useCast(). Success is announced
 * only after the TV ACKs this exact LOAD. No Chromecast/AirPlay/DLNA/history.
 */
interface MobileCastSheetProps {
  open: boolean;
  onClose: () => void;
  videoUrl?: string;
  videoTitle?: string;
  thumbnail?: string;
  currentTime?: number;
  duration?: number;
  onCastStart?: () => void;
}

const CODE_RE = /^[A-Z0-9]{6}$/;
const cleanCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function MobileCastSheet({
  open,
  onClose,
  videoUrl = "",
  videoTitle = "",
  thumbnail,
  currentTime = 0,
  duration = 0,
  onCastStart,
}: MobileCastSheetProps) {
  const cast = useCast();
  const hasMedia = !!videoUrl;

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "pair" | "load" | "reconnect">(null);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const openRef = useRef(open);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { openRef.current = open; if (!open) setShowScanner(false); }, [open]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const alive = () => mountedRef.current && openRef.current;
  const safeSet = (fn: () => void) => { if (mountedRef.current) fn(); };

  const connected = cast.isConnected && !!cast.connectedDevice;
  const tvName = cast.connectedDevice?.name || "TV";
  const pairedTv: CastDevice | undefined = cast.pairedDevices.find((d) => d.type === "remote" && !!d.sessionId);

  /** Send LOAD and wait for the exact ACK. Returns true only on confirmed playback. */
  const loadOnTv = async (sessionId: string, label: string): Promise<boolean> => {
    safeSet(() => setBusy("load"));
    const result = await cast.loadVideo(videoUrl, videoTitle, thumbnail, duration, currentTime, sessionId);
    if (result?.success) {
      if (alive()) {
        onCastStart?.();
        toast.success(`Casting to ${label}`);
        onClose();
      }
      return true;
    }
    safeSet(() => setError(result?.error || "Connected to TV but failed to launch video"));
    return false;
  };

  const run = async <T,>(kind: "pair" | "load" | "reconnect", fn: () => Promise<T>, fallback: T): Promise<T> => {
    if (busyRef.current) return fallback;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (e: any) {
      safeSet(() => setError(e?.message || "Something went wrong. Try again."));
      return fallback;
    } finally {
      busyRef.current = false;
      safeSet(() => setBusy(null));
    }
  };

  const pairAndLoad = (raw: string) =>
    run("pair", async () => {
      const c = cleanCode(raw);
      if (!CODE_RE.test(c)) {
        setError("Enter the 6-character code shown on your TV.");
        return false;
      }
      const sessionId = await cast.pairWithCode(c);
      if (!sessionId) {
        safeSet(() => setError("That code didn't work. Check the code on your TV and try again."));
        return false;
      }
      if (!hasMedia) {
        if (alive()) toast.success("Connected to TV");
        return true;
      }
      return loadOnTv(sessionId, "TV");
    }, false);

  const retryLoad = () =>
    run("load", async () => {
      const sid = cast.sessionId;
      if (!sid) { setError("The TV connection ended. Enter the TV code again."); return false; }
      return loadOnTv(sid, tvName);
    }, false);

  const reconnect = () =>
    run("reconnect", async () => {
      // Resolve only from the owner-scoped paired list at click time.
      const device = cast.pairedDevices.find((d) => d.id === pairedTv?.id && d.sessionId);
      if (!device?.sessionId) { setError("Enter the code shown on your TV to pair again."); return false; }
      const ok = await cast.reconnectToDevice(device);
      if (!ok) {
        safeSet(() => setError("That TV session expired. Enter the code shown on your TV."));
        setTimeout(() => inputRef.current?.focus(), 0);
        return false;
      }
      if (!hasMedia) { if (alive()) toast.success(`Connected to ${device.name}`); return true; }
      return loadOnTv(device.sessionId, device.name);
    }, false);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void pairAndLoad(code); };

  // Scanner: return true only if pairing AND (when media) the LOAD ACK succeeded.
  const onScanned = async (scanned: string) => {
    setCode(cleanCode(scanned));
    const ok = await pairAndLoad(scanned);
    // On failure, return to the sheet so the inline reason + retry are visible.
    if (!ok) safeSet(() => setShowScanner(false));
    return ok;
  };

  const status = cast.playbackState.videoUrl
    ? `${cast.playbackState.isPlaying ? "Playing" : "Paused"}: ${cast.playbackState.videoTitle || "video"}`
    : "Connected — nothing playing yet";

  return (
    <>
      <Sheet open={open && !showScanner} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          onOpenAutoFocus={(e) => { if (connected) return; e.preventDefault(); inputRef.current?.focus(); }}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <Tv className="h-5 w-5 text-primary" aria-hidden /> Cast to TV
            </SheetTitle>
            <SheetDescription>
              {connected ? `Connected to ${tvName}` : "Play on any TV with a web browser."}
            </SheetDescription>
          </SheetHeader>

          {error && (
            <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {connected ? (
            <div className="mt-5 space-y-4" data-testid="cast-connected">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="font-semibold">{tvName}</p>
                <p className="text-sm text-muted-foreground" aria-live="polite">{status}</p>
              </div>
              {hasMedia && (
                <Button className="h-12 w-full text-base" onClick={() => void retryLoad()} disabled={!!busy}>
                  {busy === "load" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : error ? <RotateCcw className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {busy === "load" ? "Waiting for TV…" : error ? "Retry on TV" : "Play this video on TV"}
                </Button>
              )}
              <Button variant="outline" className="h-12 w-full text-base" onClick={() => { cast.disconnect(); setError(null); }} disabled={!!busy}>
                <Unplug className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span>On your TV, open <span className="block text-2xl font-bold tracking-wide text-foreground">hoyeeh.com/tv</span></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span>Enter the code shown on the TV, or scan the TV's QR code.</span>
                </li>
              </ol>

              <form onSubmit={onSubmit} className="space-y-3">
                <label htmlFor="tv-code" className="text-sm font-medium">TV code</label>
                <input
                  id="tv-code"
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="ABC123"
                  aria-describedby="tv-code-hint"
                  className="h-16 w-full rounded-xl border border-input bg-background text-center font-mono text-3xl tracking-[0.4em] uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p id="tv-code-hint" className="sr-only">Six letters or numbers</p>
                <Button type="submit" className="h-12 w-full text-base" disabled={!!busy || code.length !== 6}>
                  {busy === "pair" || busy === "load" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {busy === "pair" ? "Connecting…" : busy === "load" ? "Waiting for TV…" : hasMedia ? "Connect & play" : "Connect"}
                </Button>
              </form>

              <Button variant="outline" className="h-12 w-full text-base" onClick={() => setShowScanner(true)} disabled={!!busy}>
                <QrCode className="mr-2 h-4 w-4" /> Scan TV QR code
              </Button>

              {pairedTv && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Paired TV</p>
                    <p className="truncate font-medium">{pairedTv.name}</p>
                  </div>
                  <Button variant="secondary" className="h-11 shrink-0" onClick={() => void reconnect()} disabled={!!busy} aria-label={`Reconnect to ${pairedTv.name}`}>
                    {busy === "reconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reconnect"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <MobileQRScanner open={open && showScanner} onClose={() => setShowScanner(false)} onCodeScanned={onScanned} />
    </>
  );
}
