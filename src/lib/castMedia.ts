/**
 * Receiver-accessibility checks for cast media.
 *
 * A TV / Chromecast fetches the media itself, so it can only play an address
 * that is reachable from the TV: never blob:/data:/file: URLs, offline-player
 * routes, or hosts that only resolve on this phone/laptop.
 */

const LOCAL_SCHEMES = ["blob:", "data:", "file:", "filesystem:", "capacitor:", "content:", "ionic:"];

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "127.0.0.1" || h === "::1" || h === "[::1]" || h === "0.0.0.0") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export interface MediaCheckOptions {
  /** Allow http://localhost fixtures (dev server / browser E2E only). */
  allowLocalhost?: boolean;
}

/** Returns a user-facing reason the TV cannot fetch this URL, or null if OK. */
export function getReceiverMediaIssue(url: string | null | undefined, opts: MediaCheckOptions = {}): string | null {
  const u = (url || "").trim();
  if (!u) return "This video has no streaming address to send to the TV.";
  const lower = u.toLowerCase();
  if (LOCAL_SCHEMES.some((s) => lower.startsWith(s))) {
    return "This video is playing from this device only, so it can't be sent to a TV.";
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return "This video's address isn't valid for casting.";
  }
  if (parsed.pathname.startsWith("/offline-play")) {
    return "Downloaded videos play on this device only and can't be cast.";
  }
  const local = isPrivateHost(parsed.hostname);
  if (local) {
    const isLoopback = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (opts.allowLocalhost && isLoopback) return null;
    return "This video is on a local address the TV can't reach.";
  }
  if (parsed.protocol !== "https:") return "The TV needs a secure (https) video address.";
  return null;
}

/** MIME type the Cast receiver needs to pick the right pipeline. */
export function guessCastMimeType(url: string): string {
  let path = url.toLowerCase();
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* keep raw */ }
  if (path.endsWith(".m3u8")) return "application/x-mpegURL";
  if (path.endsWith(".mpd")) return "application/dash+xml";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

/** Dev/E2E builds may cast a localhost fixture; production never does. */
export function castMediaOptions(): MediaCheckOptions {
  return { allowLocalhost: Boolean(import.meta.env?.DEV) };
}
