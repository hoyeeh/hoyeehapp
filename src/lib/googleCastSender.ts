/**
 * Single Google Cast Web Sender for the whole app.
 *
 * - Loads the Cast SDK at most once, and only in desktop Chrome (the Web
 *   Sender does not discover devices in mobile browsers or Capacitor WebViews).
 * - connect()/loadMedia() return explicit results; nothing is reported as
 *   success unless the Cast session exists and the receiver accepted the LOAD.
 */
import { castMediaOptions, getReceiverMediaIssue, guessCastMimeType } from "./castMedia";

export interface GoogleCastState {
  supported: boolean;
  isInitialized: boolean;
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  volume: number;
}

export interface GoogleCastResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  deviceName?: string;
}

const initialState: GoogleCastState = {
  supported: false, isInitialized: false, isAvailable: false, isConnected: false,
  deviceName: null, isPlaying: false, currentTime: 0, duration: 0, isMuted: false, volume: 1,
};

let state: GoogleCastState = { ...initialState };
const listeners = new Set<(s: GoogleCastState) => void>();
let initPromise: Promise<boolean> | null = null;
let ctx: any = null;
let player: any = null;
let controller: any = null;

function set(patch: Partial<GoogleCastState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export const getGoogleCastState = () => state;
export function subscribeGoogleCast(l: (s: GoogleCastState) => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function isGoogleCastSupportedRuntime(ua?: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.()) return false;
  const agent = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(agent)) return false;
  return /Chrome\//.test(agent) && !/Edg\/|OPR\//.test(agent);
}

function frameworkReady() {
  const w = window as any;
  return Boolean(w.cast?.framework && w.chrome?.cast?.media?.MediaInfo);
}

function initFramework(): boolean {
  const w = window as any;
  const fw = w.cast.framework;
  try {
    ctx = fw.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID || "CC1AD845",
      autoJoinPolicy: w.chrome.cast.AutoJoinPolicy?.ORIGIN_SCOPED || "origin_scoped",
      resumeSavedSession: true,
    });
    player = new fw.RemotePlayer();
    controller = new fw.RemotePlayerController(player);

    ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, (e: any) => {
      set({ isAvailable: e.castState !== fw.CastState.NO_DEVICES_AVAILABLE });
    });
    ctx.addEventListener(fw.CastContextEventType.SESSION_STATE_CHANGED, (e: any) => {
      const s = e.sessionState;
      if (s === fw.SessionState.SESSION_STARTED || s === fw.SessionState.SESSION_RESUMED) {
        const name = ctx.getCurrentSession()?.getCastDevice()?.friendlyName || "Chromecast";
        set({ isConnected: true, deviceName: name });
      } else if (s === fw.SessionState.SESSION_ENDED || s === fw.SessionState.SESSION_START_FAILED) {
        set({ isConnected: false, deviceName: null, isPlaying: false, currentTime: 0, duration: 0 });
      }
    });
    controller.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, (e: any) => {
      switch (e.field) {
        case "isPaused": set({ isPlaying: !player.isPaused }); break;
        case "currentTime": set({ currentTime: player.currentTime }); break;
        case "duration": set({ duration: player.duration }); break;
        case "volumeLevel": set({ volume: player.volumeLevel }); break;
        case "isMuted": set({ isMuted: player.isMuted }); break;
      }
    });

    const session = ctx.getCurrentSession();
    set({
      isInitialized: true,
      isAvailable: ctx.getCastState() !== fw.CastState.NO_DEVICES_AVAILABLE,
      isConnected: Boolean(session),
      deviceName: session ? session.getCastDevice()?.friendlyName || "Chromecast" : null,
    });
    return true;
  } catch (err) {
    console.error("[GoogleCast] init failed", err);
    ctx = null;
    set({ isInitialized: true, isAvailable: false });
    return false;
  }
}

export function ensureGoogleCast(timeoutMs = 10000): Promise<boolean> {
  if (initPromise) return initPromise;
  if (!isGoogleCastSupportedRuntime()) {
    set({ supported: false, isInitialized: true });
    initPromise = Promise.resolve(false);
    return initPromise;
  }
  set({ supported: true });
  initPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) set({ isInitialized: true, isAvailable: false });
      resolve(ok);
    };
    if (frameworkReady()) { finish(initFramework()); return; }
    const w = window as any;
    const prev = w.__onGCastApiAvailable;
    w.__onGCastApiAvailable = (available: boolean) => {
      try { prev?.(available); } catch { /* ignore */ }
      finish(available && frameworkReady() ? initFramework() : false);
    };
    if (!document.querySelector('script[src*="cast_sender"]')) {
      const s = document.createElement("script");
      s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
      s.async = true;
      s.onerror = () => finish(false);
      document.head.appendChild(s);
    }
    setTimeout(() => finish(false), timeoutMs);
  });
  return initPromise;
}

const errCode = (e: unknown) => (typeof e === "string" ? e : (e as any)?.code || (e as any)?.message || "error");

export async function connectGoogleCast(): Promise<GoogleCastResult> {
  const ok = await ensureGoogleCast();
  if (!ok || !ctx) return { success: false, error: "Chromecast isn't available in this browser. Use a TV code instead." };
  try {
    await ctx.requestSession();
  } catch (e) {
    const code = errCode(e);
    if (code === "cancel") return { success: false, cancelled: true, error: "Casting cancelled" };
    return { success: false, error: `Couldn't connect to the Cast device (${code}).` };
  }
  const session = ctx.getCurrentSession();
  if (!session) return { success: false, error: "No Cast session was started." };
  const deviceName = session.getCastDevice()?.friendlyName || "Chromecast";
  set({ isConnected: true, deviceName });
  return { success: true, deviceName };
}

export async function loadGoogleCastMedia(
  url: string, title?: string, thumbnail?: string, startTime = 0,
): Promise<GoogleCastResult> {
  const issue = getReceiverMediaIssue(url, castMediaOptions());
  if (issue) return { success: false, error: issue };
  const session = ctx?.getCurrentSession?.();
  if (!session) return { success: false, error: "No active Cast session." };
  const w = window as any;
  try {
    const info = new w.chrome.cast.media.MediaInfo(url, guessCastMimeType(url));
    info.streamType = w.chrome.cast.media.StreamType?.BUFFERED ?? "BUFFERED";
    const md = new w.chrome.cast.media.GenericMediaMetadata();
    md.title = title || "Video";
    if (thumbnail && !getReceiverMediaIssue(thumbnail)) md.images = [new w.chrome.cast.Image(thumbnail)];
    info.metadata = md;
    const req = new w.chrome.cast.media.LoadRequest(info);
    req.autoplay = true;
    req.currentTime = Math.max(0, Number(startTime) || 0);
    await session.loadMedia(req);
  } catch (e) {
    return { success: false, error: `The Cast device couldn't load this video (${errCode(e)}).` };
  }
  if (!session.getMediaSession?.()) return { success: false, error: "The Cast device didn't start playback." };
  set({ isPlaying: true });
  return { success: true, deviceName: state.deviceName || undefined };
}

export function disconnectGoogleCast() {
  try { ctx?.endCurrentSession(true); } catch { /* ignore */ }
  set({ isConnected: false, deviceName: null, isPlaying: false, currentTime: 0, duration: 0 });
}

export const googleCastControls = {
  play() { if (controller && player?.isPaused) controller.playOrPause(); },
  pause() { if (controller && player && !player.isPaused) controller.playOrPause(); },
  seek(t: number) { if (controller && player) { player.currentTime = t; controller.seek(); } },
  setVolume(v: number) { if (controller && player) { player.volumeLevel = Math.max(0, Math.min(1, v)); controller.setVolumeLevel(); } },
  setMuted(m: boolean) { if (controller && player && player.isMuted !== m) controller.muteOrUnmute(); },
  stop() { controller?.stop(); },
};

/** Test-only reset. */
export function __resetGoogleCastForTests() {
  state = { ...initialState }; initPromise = null; ctx = null; player = null; controller = null;
  listeners.clear();
}
