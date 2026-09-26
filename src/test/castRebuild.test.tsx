import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getReceiverMediaIssue, guessCastMimeType } from "@/lib/castMedia";
import {
  __resetGoogleCastForTests, connectGoogleCast, loadGoogleCastMedia, isGoogleCastSupportedRuntime,
} from "@/lib/googleCastSender";
import { CastAckTracker } from "@/lib/castAckTracker";

const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const setUA = (ua: string) => Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });

function installFakeSdk(opts: { request?: () => Promise<void>; load?: (req: any) => Promise<void> } = {}) {
  let current: any = null;
  const session = {
    getCastDevice: () => ({ friendlyName: "Living Room TV" }),
    loadMedia: vi.fn(opts.load ?? (async () => {})),
    getMediaSession: () => ({}),
  };
  const ctx = {
    setOptions: vi.fn(),
    getCastState: () => "NOT_CONNECTED",
    getCurrentSession: () => current,
    requestSession: vi.fn(async () => { await (opts.request ?? (async () => {}))(); current = session; }),
    addEventListener: vi.fn(),
    endCurrentSession: vi.fn(() => { current = null; }),
  };
  (window as any).cast = { framework: {
    CastContext: { getInstance: () => ctx },
    RemotePlayer: class {}, RemotePlayerController: class { addEventListener() {} },
    CastContextEventType: { CAST_STATE_CHANGED: "c", SESSION_STATE_CHANGED: "s" },
    RemotePlayerEventType: { ANY_CHANGE: "a" }, CastState: { NO_DEVICES_AVAILABLE: "NO" }, SessionState: {},
  } };
  (window as any).chrome = { cast: {
    media: {
      MediaInfo: class { contentId: string; contentType: string; constructor(u: string, t: string) { this.contentId = u; this.contentType = t; } },
      GenericMediaMetadata: class {}, LoadRequest: class { media: any; constructor(i: any) { this.media = i; } },
      StreamType: { BUFFERED: "BUFFERED" },
    },
    Image: class { constructor(public url: string) {} }, AutoJoinPolicy: { ORIGIN_SCOPED: "o" },
  } };
  return { ctx, session };
}

describe("receiver-accessible media", () => {
  it("refuses media a TV cannot fetch", () => {
    expect(getReceiverMediaIssue("blob:https://hoyeeh.com/abc")).toMatch(/this device/);
    expect(getReceiverMediaIssue("https://hoyeeh.com/offline-play/123")).toMatch(/Downloaded/);
    expect(getReceiverMediaIssue("http://192.168.1.4/v.mp4")).toMatch(/local address/);
    expect(getReceiverMediaIssue("http://cdn.example.com/v.mp4")).toMatch(/https/);
    expect(getReceiverMediaIssue("")).toMatch(/no streaming address/);
    expect(getReceiverMediaIssue("http://localhost:8080/f.webm")).not.toBeNull();
    expect(getReceiverMediaIssue("http://localhost:8080/f.webm", { allowLocalhost: true })).toBeNull();
    expect(getReceiverMediaIssue("https://stream.mux.com/x.m3u8")).toBeNull();
  });
  it("picks the right MIME for the receiver", () => {
    expect(guessCastMimeType("https://stream.mux.com/x.m3u8?token=1")).toBe("application/x-mpegURL");
    expect(guessCastMimeType("https://a.b/v.webm")).toBe("video/webm");
    expect(guessCastMimeType("https://a.b/v.mp4")).toBe("video/mp4");
  });
});

describe("Google Cast sender (single SDK, truthful results)", () => {
  beforeEach(() => { __resetGoogleCastForTests(); delete (window as any).cast; delete (window as any).chrome; });
  afterEach(() => setUA("jsdom"));

  it("is only offered in desktop Chrome, not mobile web or native shells", () => {
    expect(isGoogleCastSupportedRuntime(CHROME_UA)).toBe(true);
    expect(isGoogleCastSupportedRuntime(ANDROID_UA)).toBe(false);
    (window as any).Capacitor = { isNativePlatform: () => true };
    expect(isGoogleCastSupportedRuntime(CHROME_UA)).toBe(false);
    delete (window as any).Capacitor;
  });

  it("mobile web: connect fails honestly without loading any SDK", async () => {
    setUA(ANDROID_UA);
    const r = await connectGoogleCast();
    expect(r.success).toBe(false);
    expect(document.querySelector('script[src*="cast_sender"]')).toBeNull();
  });

  it("user cancel is reported as cancelled, not success", async () => {
    setUA(CHROME_UA);
    installFakeSdk({ request: async () => { throw "cancel"; } });
    const r = await connectGoogleCast();
    expect(r).toMatchObject({ success: false, cancelled: true });
  });

  it("connect → load returns device, sends HLS MIME and start time", async () => {
    setUA(CHROME_UA);
    const { session } = installFakeSdk();
    const c = await connectGoogleCast();
    expect(c).toMatchObject({ success: true, deviceName: "Living Room TV" });
    const l = await loadGoogleCastMedia("https://stream.mux.com/abc.m3u8", "Film", undefined, 42);
    expect(l.success).toBe(true);
    const req = session.loadMedia.mock.calls[0][0];
    expect(req.media.contentType).toBe("application/x-mpegURL");
    expect(req.currentTime).toBe(42);
  });

  it("receiver load error surfaces as failure (not swallowed)", async () => {
    setUA(CHROME_UA);
    installFakeSdk({ load: async () => { throw "LOAD_FAILED"; } });
    await connectGoogleCast();
    const l = await loadGoogleCastMedia("https://cdn.hoyeeh.com/v.mp4", "Film");
    expect(l.success).toBe(false);
    expect(l.error).toMatch(/LOAD_FAILED/);
  });

  it("never sends a blob/offline source to the Cast device", async () => {
    setUA(CHROME_UA);
    const { session } = installFakeSdk();
    await connectGoogleCast();
    const l = await loadGoogleCastMedia("blob:https://hoyeeh.com/1", "Film");
    expect(l.success).toBe(false);
    expect(session.loadMedia).not.toHaveBeenCalled();
  });
});

describe("TV-code exact-seq ACK", () => {
  it("only the exact seq succeeds; error ack fails; newer command supersedes", async () => {
    const t = new CastAckTracker(1000);
    const load = t.wait(5);
    t.observe({ lastAckedSeq: 6, lastAckStatus: "success", commandSeq: 6 });
    expect(await load).toMatchObject({ acked: false, superseded: true });
    const load2 = t.wait(7);
    t.observe({ lastAckedSeq: 7, lastAckStatus: "error", lastAckError: "MEDIA_ERR_SRC_NOT_SUPPORTED", commandSeq: 7 });
    expect(await load2).toMatchObject({ acked: false, error: "MEDIA_ERR_SRC_NOT_SUPPORTED" });
    const load3 = t.wait(8);
    t.observe({ lastAckedSeq: 8, lastAckStatus: "success", commandSeq: 8 });
    expect(await load3).toEqual({ acked: true });
  });
  it("times out instead of claiming success", async () => {
    vi.useFakeTimers();
    const t = new CastAckTracker(500);
    const p = t.wait(1);
    vi.advanceTimersByTime(600);
    expect(await p).toMatchObject({ acked: false, timedOut: true });
    vi.useRealTimers();
  });
});

// ---- MobileCastSheet (mobile reconnect + Chromecast result handling) ----
const castMock: any = {};
vi.mock("@/contexts/CastContext", () => ({ useCast: () => castMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/cast/CastPairingDialog", () => ({ CastPairingDialog: () => null }));
vi.mock("@/components/DLNASetupGuide", () => ({ DLNASetupGuide: () => null }));
vi.mock("@/components/mobile/MobileQRScanner", () => ({ MobileQRScanner: () => null }));

function resetCastMock() {
  Object.assign(castMock, {
    isConnected: false, pairedDevices: [], sessionId: null,
    pairWithCode: vi.fn(), reconnectToDevice: vi.fn(async () => true),
    loadVideo: vi.fn(async () => ({ success: true, acked: true, seq: 3 })),
    getActiveConnection: () => ({ type: null, device: null }),
    chromecast: { isAvailable: true, isConnected: false, deviceName: null, platformWarning: null,
      connect: vi.fn(async () => ({ success: false, error: "Couldn't connect" })), loadMedia: vi.fn() },
    airPlay: { isAvailable: false, showPicker: vi.fn() },
    dlna: { devices: [], savedDevices: [], isScanning: false, scanForDevices: vi.fn(), connect: vi.fn(), playMedia: vi.fn() },
  });
}

describe("MobileCastSheet", () => {
  beforeEach(() => { resetCastMock(); localStorage.clear(); });

  it("reconnect uses the saved sessionId and waits for the LOAD ack before onCastStart", async () => {
    castMock.pairedDevices = [{ id: "rcv-sess-1", name: "Bedroom TV", type: "remote", sessionId: "sess-1" }];
    let resolveLoad: (v: any) => void = () => {};
    castMock.loadVideo = vi.fn(() => new Promise((r) => { resolveLoad = r; }));
    const onCastStart = vi.fn();
    const { MobileCastSheet } = await import("@/components/mobile/MobileCastSheet");
    render(<MobileCastSheet open onClose={() => {}} videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" currentTime={120} duration={3600} onCastStart={onCastStart} />);
    fireEvent.click(screen.getByText("Recent"));
    fireEvent.click(await screen.findByText("Bedroom TV"));
    await waitFor(() => expect(castMock.loadVideo).toHaveBeenCalled());
    expect(castMock.reconnectToDevice).toHaveBeenCalledWith(expect.objectContaining({ id: "rcv-sess-1", sessionId: "sess-1" }));
    expect(castMock.loadVideo).toHaveBeenCalledWith("https://cdn.hoyeeh.com/v.mp4", "Film", undefined, 3600, 120, "sess-1");
    expect(onCastStart).not.toHaveBeenCalled();
    resolveLoad({ success: true, acked: true, seq: 4 });
    await waitFor(() => expect(onCastStart).toHaveBeenCalledTimes(1));
  });

  it("failed LOAD after reconnect never calls onCastStart", async () => {
    castMock.pairedDevices = [{ id: "rcv-sess-2", name: "Bedroom TV", type: "remote", sessionId: "sess-2" }];
    castMock.loadVideo = vi.fn(async () => ({ success: false, timedOut: true, error: "TV did not confirm playback in time" }));
    const onCastStart = vi.fn();
    const { MobileCastSheet } = await import("@/components/mobile/MobileCastSheet");
    render(<MobileCastSheet open onClose={() => {}} videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" onCastStart={onCastStart} />);
    fireEvent.click(screen.getByText("Recent"));
    fireEvent.click(await screen.findByText("Bedroom TV"));
    await waitFor(() => expect(castMock.loadVideo).toHaveBeenCalled());
    expect(onCastStart).not.toHaveBeenCalled();
  });

  it("expired reconnect does not try to load", async () => {
    castMock.pairedDevices = [{ id: "rcv-old", name: "Bedroom TV", type: "remote", sessionId: "old" }];
    castMock.reconnectToDevice = vi.fn(async () => false);
    const { MobileCastSheet } = await import("@/components/mobile/MobileCastSheet");
    render(<MobileCastSheet open onClose={() => {}} videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" />);
    fireEvent.click(screen.getByText("Recent"));
    fireEvent.click(await screen.findByText("Bedroom TV"));
    await waitFor(() => expect(castMock.reconnectToDevice).toHaveBeenCalled());
    expect(castMock.loadVideo).not.toHaveBeenCalled();
  });

  it("history entries never carry TV sessions; unpaired TV asks for a new code", async () => {
    localStorage.setItem("cast_device_history", JSON.stringify([
      { id: "chromecast-default", name: "Kitchen Cast", type: "chromecast", lastUsed: Date.now() },
    ]));
    const { MobileCastSheet } = await import("@/components/mobile/MobileCastSheet");
    render(<MobileCastSheet open onClose={() => {}} videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" />);
    fireEvent.click(screen.getByText("Recent"));
    expect(screen.queryByText("Paired TVs")).toBeNull();
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/hooks/useCastHistory.ts", "utf8")).not.toMatch(/sessionId/);
    expect(castMock.reconnectToDevice).not.toHaveBeenCalled();
  });

  it("Chromecast connect failure never loads media or starts casting", async () => {
    (window as any).cast = { framework: {} }; (window as any).chrome = { cast: {} };
    const onCastStart = vi.fn();
    const { MobileCastSheet } = await import("@/components/mobile/MobileCastSheet");
    render(<MobileCastSheet open onClose={() => {}} videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" onCastStart={onCastStart} />);
    fireEvent.click(screen.getByText("Chromecast"));
    await waitFor(() => expect(castMock.chromecast.connect).toHaveBeenCalled());
    expect(castMock.chromecast.loadMedia).not.toHaveBeenCalled();
    expect(onCastStart).not.toHaveBeenCalled();
    delete (window as any).cast; delete (window as any).chrome;
  });
});

describe("single cast path per player", () => {
  it("desktop VideoPlayer no longer mounts competing Cast SDK / DLNA / native plugin buttons", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/VideoPlayer.tsx", "utf8");
    expect(src).not.toMatch(/useGoogleCast|useDLNA|NativeCastButton|AirPlayButton/);
    expect(src).toMatch(/<UnifiedCastButton/);
    expect(src).toMatch(/<CastToTVButton/);
  });
  it("/cast page uses the shared signaling controller and awaits the LOAD result", async () => {
    const { readFileSync } = await import("node:fs");
    const hook = readFileSync("src/hooks/useCastController.ts", "utf8");
    expect(hook).not.toMatch(/functions\/v1\/cast-signaling/);
    expect(hook).toMatch(/useCast\(\)/);
    const page = readFileSync("src/pages/Cast.tsx", "utf8");
    expect(page).toMatch(/const result = await loadVideo\(v\);\s*if \(result\.success\)/);
  });
});

describe("UniversalCastButton (title page)", () => {
  beforeEach(() => resetCastMock());
  it("does not call onCastStart or say 'Casting' when the TV rejects LOAD", async () => {
    Object.assign(castMock, {
      isConnected: true, connectedDevice: { id: "rcv", name: "Den TV", type: "remote", sessionId: "s" },
      loadVideo: vi.fn(async () => ({ success: false, error: "TV reported playback error" })),
    });
    const onCastStart = vi.fn();
    const { UniversalCastButton } = await import("@/components/cast/UniversalCastButton");
    render(<UniversalCastButton videoUrl="https://cdn.hoyeeh.com/v.mp4" videoTitle="Film" onCastStart={onCastStart} />);
    expect(screen.getByRole("button", { name: /Connected to Den TV/ })).toBeTruthy();
    expect(screen.queryByText(/Casting to Den TV/)).toBeNull();
    const src = (await import("node:fs")).readFileSync("src/components/cast/UniversalCastButton.tsx", "utf8");
    expect(src).toMatch(/if \(!result\?\.success\)[\s\S]*return false;[\s\S]*setCastingConfirmed\(true\);\s*onCastStart\?\.\(\)/);
    expect(src).not.toMatch(/useUniversalCast\(\)/);
    expect(onCastStart).not.toHaveBeenCalled();
  });
});

describe("CastToTVButton", () => {
  it("draws no fake QR and never encodes a custom-scheme pairing link", async () => {
    const src = (await import("node:fs")).readFileSync("src/components/cast/CastToTVButton.tsx", "utf8");
    expect(src).not.toMatch(/generateQRCodeSVG|hoyeeh:\/\/pair|dangerouslySetInnerHTML/);
    const tv = (await import("node:fs")).readFileSync("public/tv-receiver/index.html", "utf8");
    expect(tv).toMatch(/'https:\/\/hoyeeh\.com\/cast\?code=' \+ code/);
  });
});

describe("browser Remote Playback is not labelled as Chromecast", () => {
  it("UnifiedCastButton names it the browser picker", async () => {
    const src = (await import("node:fs")).readFileSync("src/components/player/UnifiedCastButton.tsx", "utf8");
    expect(src).toMatch(/aria-label="Cast with browser picker"/);
  });
  it("no native Cast plugin UI exists without a real bridge", async () => {
    const fs = await import("node:fs");
    expect(fs.existsSync("src/components/cast/NativeCastButton.tsx")).toBe(false);
    expect(fs.existsSync("src/hooks/useNativeCast.ts")).toBe(false);
    expect(fs.existsSync("src/components/cast/CastPanel.tsx")).toBe(false);
  });
});

describe("Google Cast Web Sender runtime gate", () => {
  it("rejects Chrome on iOS and mobile, accepts desktop Chrome", async () => {
    const { isGoogleCastSupportedRuntime: ok } = await import("@/lib/googleCastSender");
    expect(ok("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(ok("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 CriOS/120.0 Safari/604.1")).toBe(false);
    expect(ok("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")).toBe(false);
    expect(ok("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")).toBe(true);
  });
});
