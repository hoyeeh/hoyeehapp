import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Lightweight framer-motion: render plain elements, drop animation props.
vi.mock("framer-motion", () => {
  const strip = (p: any) => {
    const { initial, animate, exit, transition, drag, dragConstraints, dragElastic, onDrag, onDragEnd, whileTap, whileHover, layout, ...rest } = p;
    return rest;
  };
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef((p: any, ref) => React.createElement(tag, { ...strip(p), ref })) });
  return { motion, AnimatePresence: ({ children }: any) => <>{children}</> };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/LogoOpener", () => ({ LogoOpener: () => null }));
vi.mock("@/hooks/useLogoOpener", () => ({ useLogoOpener: () => ({ showOpener: false, handleOpenerComplete: vi.fn(), shouldShowOpener: false, markOpenerShown: vi.fn() }) }));
vi.mock("@/hooks/useWatchProgress", () => ({ useWatchProgress: () => ({ progress: null, saveProgress: vi.fn(), getProgress: vi.fn(), updateProgress: vi.fn() }) }));
vi.mock("@/components/mobile/MobileCastSheet", () => ({ MobileCastSheet: (p: any) => (p.open ? <div role="dialog" aria-label="Cast to TV" /> : null) }));
vi.mock("@/contexts/CastContext", () => ({ useCast: () => ({ isConnected: false, isConnecting: false, pairedDevices: [], playbackState: {} }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useNetworkQuality", () => ({ useNetworkQuality: () => ({ quality: "high", recommendedQuality: "auto" }) }));
vi.mock("@/hooks/usePictureInPicture", () => ({ usePictureInPicture: () => ({ isSupported: false, isActive: false, toggle: vi.fn() }) }));
vi.mock("@/hooks/useCastHistory", () => ({ useCastHistory: () => ({ lastUsedDevice: null, addDevice: vi.fn(), history: [] }) }));
vi.mock("@/lib/playbackStorage", () => ({ savePlaybackPosition: vi.fn(), getPlaybackPosition: vi.fn(async () => null) }));
vi.mock("@/hooks/useSkipPreferences", () => ({ useSkipPreferences: () => ({ autoSkipIntro: false, autoSkipRecap: false, preferences: {} }) }));
vi.mock("@/hooks/useAdmin", () => ({ useIsAdmin: () => ({ data: false }) }));
vi.mock("@/contexts/WatchPartyContext", () => ({ useWatchPartyContext: () => ({ party: null, members: [], messages: [], isHost: false, isWatchPartyGuest: false, isSyncing: false, updatePlayback: vi.fn(), syncToParty: vi.fn() }) }));
vi.mock("@/hooks/useSubtitles", () => ({ useSubtitles: () => ({ isSubtitlesEnabled: false, currentCue: null, tracks: [], availableLanguages: [], updateTime: vi.fn() }) }));
vi.mock("@/components/SubtitleDisplay", () => ({ SubtitleDisplay: () => null }));
vi.mock("@/components/mobile/MobileWatchPartyReactions", () => ({ MobileWatchPartyReactions: () => null }));
vi.mock("@/components/watch-party/WatchPartyMembersOverlay", () => ({ WatchPartyMembersOverlay: () => null }));
vi.mock("@/components/watch-party/WatchPartyChatOverlay", () => ({ WatchPartyChatOverlay: () => null }));
vi.mock("@/components/watch-party/WatchPartyEndedOverlay", () => ({ WatchPartyEndedOverlay: () => null }));
vi.mock("@/components/watch-party/FloatingChatInput", () => ({ FloatingChatInput: () => null }));

import { MobileVideoPlayer } from "@/components/mobile/MobileVideoPlayer";

let playImpl: () => Promise<void>;
beforeEach(() => {
  vi.useFakeTimers();
  playImpl = () => Promise.resolve();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: function () { return playImpl(); } });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: function () { this.dispatchEvent(new Event("pause")); } });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: () => {} });
});
afterEach(() => vi.useRealTimers());

const content: any = { id: "c1", title: "Film", thumbnailUrl: "" };
const renderPlayer = (props: any = {}) =>
  render(<MobileVideoPlayer content={content} videoUrl="https://cdn.hoyeeh.com/v.mp4" title="Film" onClose={vi.fn()} {...props} />);
const video = () => screen.getByTestId("mobile-video") as HTMLVideoElement;
const flush = async (ms = 0) => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(ms); }); };
const fire = async (name: string) => { await act(async () => { video().dispatchEvent(new Event(name)); }); };

describe.each([["main", false], ["kids", true]])("MobileVideoPlayer controls (%s profile)", (_n, isKidsMode) => {
  it("active playback: controls auto-hide, tap shows them, tap again hides", async () => {
    renderPlayer({ isKidsMode, kidsProfileId: isKidsMode ? "k1" : undefined });
    await flush();
    await fire("playing");
    expect(screen.queryByTestId("tap-to-play")).toBeNull();
    await flush(3100);
    expect(screen.queryByTestId("mobile-controls")).toBeNull();
    // tap on player surface -> controls appear (single-tap delay 250ms)
    fireEvent.click(video());
    await flush(300);
    expect(screen.getByTestId("mobile-controls")).toBeTruthy();
    expect(screen.getByTestId("center-play-toggle").getAttribute("aria-label")).toBe("Pause");
    // tap empty overlay space -> hides immediately (not re-shown by the timer reset)
    fireEvent.click(screen.getByTestId("mobile-controls"));
    await flush(10);
    expect(screen.queryByTestId("mobile-controls")).toBeNull();
  });

  it("paused: controls stay visible with an accessible Play", async () => {
    renderPlayer({ isKidsMode });
    await flush();
    await fire("playing");
    await fire("pause");
    await flush(5000);
    expect(screen.getByTestId("mobile-controls")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    // Kids mode hides casting; main shows it.
    expect(screen.queryAllByRole("button", { name: "Cast to TV" }).length > 0).toBe(!isKidsMode);
  });

  it("autoplay blocked: tap-to-play fallback shown, cleared by the real playing event", async () => {
    playImpl = () => Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    renderPlayer({ isKidsMode });
    await flush(); await flush();
    const fallback = screen.getByRole("button", { name: "Tap to play" });
    expect(fallback).toBeTruthy();
    playImpl = () => Promise.resolve();
    fireEvent.click(fallback);
    await fire("playing");
    expect(screen.queryByTestId("tap-to-play")).toBeNull();
  });

  it("aborted autoplay (src swap) does not leave a stale fallback", async () => {
    playImpl = () => Promise.reject(Object.assign(new Error("abort"), { name: "AbortError" }));
    renderPlayer({ isKidsMode });
    await flush(); await flush();
    expect(screen.queryByTestId("tap-to-play")).toBeNull();
  });

  it("error: controls stay visible while playing state stops", async () => {
    renderPlayer({ isKidsMode });
    await flush();
    await fire("playing");
    await fire("error");
    await fire("pause");
    await flush(5000);
    expect(screen.getByTestId("mobile-controls")).toBeTruthy();
  });
});
