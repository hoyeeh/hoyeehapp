import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Desktop entry path: src/pages/Index.tsx renders <VideoPlayer> for
// playingContent && !isMobileOrTablet — for BOTH main and Kids profiles.
vi.mock("framer-motion", () => {
  const strip = (p: any) => { const { initial, animate, exit, transition, whileTap, whileHover, layout, ...r } = p; return r; };
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef((p: any, ref) => React.createElement(tag, { ...strip(p), ref })) });
  return { motion, AnimatePresence: ({ children }: any) => <>{children}</> };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/LogoOpener", () => ({ LogoOpener: () => null }));
vi.mock("@/hooks/useLogoOpener", () => ({ useLogoOpener: () => ({ showOpener: false, handleOpenerComplete: vi.fn(), shouldShowOpener: false, markOpenerShown: vi.fn() }) }));
vi.mock("@/contexts/WatchPartyContext", () => ({ useWatchPartyContext: () => ({ party: null, members: [], messages: [], isHost: false, isWatchPartyGuest: false, isSyncing: false, updatePlayback: vi.fn(), syncToParty: vi.fn() }) }));
vi.mock("@/hooks/useWatchProgress", () => ({ useWatchProgress: () => ({ progress: null, saveProgress: vi.fn(), getProgress: vi.fn(), updateProgress: vi.fn() }) }));
vi.mock("@/hooks/usePictureInPicture", () => ({ usePictureInPicture: () => ({ isSupported: false, isActive: false, toggle: vi.fn() }) }));
vi.mock("@/hooks/useNetworkQuality", () => ({ useNetworkQuality: () => ({ quality: "high", recommendedQuality: "auto" }) }));
vi.mock("@/components/cast/CastToTVButton", () => ({ CastToTVButton: () => null }));
vi.mock("@/components/player/UnifiedCastButton", () => ({ UnifiedCastButton: () => null }));
vi.mock("@/components/SubtitleDisplay", () => ({ SubtitleDisplay: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: null }), single: async () => ({ data: null }), then: (r: any) => r({ data: [] }) };
  return { supabase: { from: () => q, auth: { getUser: async () => ({ data: { user: null } }) } } };
});
vi.mock("@/hooks/useSkipPreferences", () => ({ useSkipPreferences: () => ({ autoSkipIntro: false, autoSkipRecap: false, preferences: {} }) }));
vi.mock("@/hooks/useAdmin", () => ({ useIsAdmin: () => ({ data: false }) }));
vi.mock("@/hooks/useSubtitles", () => ({ useSubtitles: () => ({ isSubtitlesEnabled: false, currentCue: null, tracks: [], availableLanguages: [], updateTime: vi.fn() }) }));

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
import { VideoPlayer as VPC } from "@/components/VideoPlayer";
const VideoPlayer: any = VPC;

let playImpl: () => Promise<void>;
beforeEach(() => {
  vi.useFakeTimers();
  playImpl = () => Promise.resolve();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: function () { return playImpl(); } });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: function () { this.dispatchEvent(new Event("pause")); } });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: () => {} });
});
afterEach(() => vi.useRealTimers());

const vid = () => document.querySelector("video") as HTMLVideoElement;
const fire = async (n: string) => { await act(async () => { vid().dispatchEvent(new Event(n)); }); };
const tick = async (ms: number) => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(ms); }); };
const overlayOf = () => screen.getByTestId("center-play-toggle").closest(".transition-opacity") as HTMLElement;

describe.each([["main"], ["kids"]])("Desktop VideoPlayer from Index (%s profile)", () => {
  it("center icon: Play before real playback, Pause while playing, controls auto-hide and stop intercepting", async () => {
    render(<VideoPlayer src="https://cdn.hoyeeh.com/v.mp4" title="Film" contentId="c1" initialProgress={0} onBack={vi.fn()} />);
    await tick(0);
    expect(screen.getByTestId("center-play-toggle").getAttribute("aria-label")).toBe("Play");
    await fire("playing");
    expect(screen.getByTestId("center-play-toggle").getAttribute("aria-label")).toBe("Pause");
    await tick(5100);
    expect(overlayOf().className).toContain("pointer-events-none");
    await fire("pause");
    expect(overlayOf().className).toContain("opacity-100");
    expect(screen.getByTestId("center-play-toggle").getAttribute("aria-label")).toBe("Play");
  });

  it("blocked play shows accessible Tap to play, cleared only by the playing event", async () => {
    render(<VideoPlayer src="https://cdn.hoyeeh.com/v.mp4" title="Film" contentId="c1" initialProgress={0} onBack={vi.fn()} />);
    await tick(0);
    playImpl = () => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    fireEvent.click(screen.getByTestId("center-play-toggle"));
    await tick(0);
    const fb = screen.getByRole("button", { name: "Tap to play" });
    playImpl = () => Promise.resolve();
    fireEvent.click(fb);
    await tick(0);
    expect(screen.queryByTestId("tap-to-play")).toBeTruthy();
    await fire("playing");
    expect(screen.queryByTestId("tap-to-play")).toBeNull();
  });
});
