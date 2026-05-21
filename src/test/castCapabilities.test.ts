import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCastCapabilities,
  getEnabledProtocols,
  isAirPlayCapable,
  isChromecastSdkLoaded,
} from "@/player/castCapabilities";

describe("castCapabilities", () => {
  const originalNav = Object.getOwnPropertyDescriptor(window, "navigator");
  const originalCast = (window as any).cast;
  const originalChrome = (window as any).chrome;
  const originalCapacitor = (window as any).Capacitor;

  afterEach(() => {
    (window as any).cast = originalCast;
    (window as any).chrome = originalChrome;
    (window as any).Capacitor = originalCapacitor;
    if (originalNav) Object.defineProperty(window, "navigator", originalNav);
    vi.restoreAllMocks();
  });

  it("hides chromecast when SDK is not loaded (the current preview/iframe case)", () => {
    delete (window as any).cast;
    delete (window as any).chrome;
    const caps = getCastCapabilities({ chromecastAvailable: true });
    expect(caps.chromecast.enabled).toBe(false);
    expect(caps.chromecast.reason).toMatch(/Web SDK/i);
  });

  it("enables chromecast only when SDK is loaded AND hook reports available", () => {
    (window as any).cast = { framework: {} };
    (window as any).chrome = { cast: {} };
    expect(getCastCapabilities({ chromecastAvailable: true }).chromecast.enabled).toBe(true);
    expect(getCastCapabilities({ chromecastAvailable: false }).chromecast.enabled).toBe(false);
  });

  it("hides airplay outside Safari/iOS", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120" },
    });
    const caps = getCastCapabilities({ airplayAvailable: true });
    expect(caps.airplay.enabled).toBe(false);
  });

  it("hides DLNA on web with zero discovered devices", () => {
    const caps = getCastCapabilities({ dlnaDeviceCount: 0 });
    expect(caps.dlna.enabled).toBe(false);
    expect(caps.dlna.reason).toMatch(/disabled on the web/i);
  });

  it("enables DLNA when at least one device is discovered", () => {
    const caps = getCastCapabilities({ dlnaDeviceCount: 1 });
    expect(caps.dlna.enabled).toBe(true);
  });

  it("nativeCast is disabled without Capacitor GoogleCast plugin", () => {
    delete (window as any).Capacitor;
    expect(getCastCapabilities().nativeCast.enabled).toBe(false);
  });

  it("tvPairing and qrFallback are ALWAYS enabled (no platform deps)", () => {
    const caps = getCastCapabilities();
    expect(caps.tvPairing.enabled).toBe(true);
    expect(caps.qrFallback.enabled).toBe(true);
  });

  it("getEnabledProtocols filters down to only the working ones", () => {
    delete (window as any).cast;
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 Chrome/120" },
    });
    const list = getEnabledProtocols({ chromecastAvailable: false, dlnaDeviceCount: 0 });
    expect(list).toEqual(expect.arrayContaining(["tvPairing", "qrFallback"]));
    expect(list).not.toContain("chromecast");
    expect(list).not.toContain("airplay");
    expect(list).not.toContain("dlna");
  });

  it("isAirPlayCapable / isChromecastSdkLoaded are SSR-safe", () => {
    expect(() => isAirPlayCapable()).not.toThrow();
    expect(() => isChromecastSdkLoaded()).not.toThrow();
  });
});
