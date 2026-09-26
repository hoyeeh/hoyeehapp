/**
 * Cast capability matrix.
 *
 * Single source of truth for which casting protocols are "verified working"
 * in the current runtime. Cast UIs (desktop CastPanel, MobileCastSheet,
 * mini-player) should hide protocols where `enabled === false` instead of
 * rendering a button that immediately errors.
 *
 * Detection rules:
 *  - chromecast: requires the Google Cast Web SDK actually loaded
 *    (window.cast?.framework). The SDK frequently fails to load in
 *    iframes / PWAs / non-Chromium browsers; when it does, we hide the
 *    entry rather than show a dead button.
 *  - airplay: requires Safari/iOS which fires
 *    WebKitPlaybackTargetAvailabilityEvent on <video>. Detected by feature
 *    presence on HTMLVideoElement.prototype.
 *  - dlna: web browsers cannot perform native SSDP discovery; only enabled
 *    inside a Capacitor native shell that bridges to a local relay.
 *  - nativeCast: Capacitor + Google Cast plugin must be registered.
 *  - tvPairing / qrFallback: always available — pure UI flow that POSTs a
 *    short code to /tv-receiver, no browser API required.
 *
 * All detection is SSR-safe (every `window` / `navigator` access is
 * guarded) so the module can be imported from any layer including tests.
 */

export type CastProtocol =
  | "chromecast"
  | "airplay"
  | "dlna"
  | "nativeCast"
  | "tvPairing"
  | "qrFallback";

export interface CastCapability {
  protocol: CastProtocol;
  enabled: boolean;
  reason?: string;
}

export interface CastCapabilities {
  chromecast: CastCapability;
  airplay: CastCapability;
  dlna: CastCapability;
  nativeCast: CastCapability;
  tvPairing: CastCapability;
  qrFallback: CastCapability;
}

const hasWindow = (): boolean => typeof window !== "undefined";
const hasNavigator = (): boolean => typeof navigator !== "undefined";

export function isNativeCapacitor(): boolean {
  if (!hasWindow()) return false;
  const w = window as any;
  return Boolean(
    w.Capacitor?.isNativePlatform?.() ||
      w.Capacitor?.platform === "ios" ||
      w.Capacitor?.platform === "android"
  );
}

export function isSafariOrIOS(): boolean {
  if (!hasNavigator()) return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIOS || isSafari;
}

export function isAirPlayCapable(): boolean {
  if (!hasWindow()) return false;
  try {
    const video = document.createElement("video") as any;
    // Safari sets webkitShowPlaybackTargetPicker on <video> instances.
    return typeof video.webkitShowPlaybackTargetPicker === "function";
  } catch {
    return false;
  }
}

export function isChromecastSdkLoaded(): boolean {
  if (!hasWindow()) return false;
  const w = window as any;
  return Boolean(w.cast?.framework && w.chrome?.cast);
}

export function isNativeCastPluginAvailable(): boolean {
  if (!isNativeCapacitor()) return false;
  const w = window as any;
  return Boolean(w.Capacitor?.Plugins?.GoogleCast);
}

/**
 * Build a capability matrix for the current runtime.
 *
 * Pass overrides (e.g. from React hook state like `useGoogleCast`'s
 * `isAvailable`) to incorporate live SDK state. Without overrides, this
 * returns pure feature-detection results.
 */
export function getCastCapabilities(overrides?: {
  chromecastAvailable?: boolean;
  airplayAvailable?: boolean;
  dlnaDeviceCount?: number;
}): CastCapabilities {
  const native = isNativeCapacitor();
  const sdkLoaded = isChromecastSdkLoaded();
  const chromecastReady =
    overrides?.chromecastAvailable !== undefined
      ? overrides.chromecastAvailable && sdkLoaded
      : sdkLoaded;

  const airplaySupported =
    overrides?.airplayAvailable !== undefined
      ? overrides.airplayAvailable
      : isAirPlayCapable();

  const dlnaCount = overrides?.dlnaDeviceCount ?? 0;

  return {
    chromecast: {
      protocol: "chromecast",
      enabled: chromecastReady,
      reason: chromecastReady
        ? undefined
        : "Google Cast Web SDK is not available in this browser.",
    },
    airplay: {
      protocol: "airplay",
      enabled: airplaySupported && isSafariOrIOS(),
      reason:
        airplaySupported && isSafariOrIOS()
          ? undefined
          : "AirPlay only works in Safari on macOS or iOS.",
    },
    dlna: {
      protocol: "dlna",
      // Only advertise DLNA when real devices were actually discovered.
      enabled: dlnaCount > 0,
      reason:
        dlnaCount > 0
          ? undefined
          : native
            ? "No DLNA devices were found on this network."
            : "DLNA discovery is disabled on the web. Use TV pairing or QR code instead.",
    },
    nativeCast: {
      protocol: "nativeCast",
      enabled: isNativeCastPluginAvailable(),
      reason: isNativeCastPluginAvailable()
        ? undefined
        : "Native Google Cast plugin is only available in the installed mobile app.",
    },
    tvPairing: {
      protocol: "tvPairing",
      enabled: true,
    },
    qrFallback: {
      protocol: "qrFallback",
      enabled: true,
    },
  };
}

/** Convenience: list only the protocols a UI should render right now. */
export function getEnabledProtocols(
  overrides?: Parameters<typeof getCastCapabilities>[0]
): CastProtocol[] {
  const caps = getCastCapabilities(overrides);
  return (Object.keys(caps) as CastProtocol[]).filter((p) => caps[p].enabled);
}
