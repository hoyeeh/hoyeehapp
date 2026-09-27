import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";

vi.mock("framer-motion", () => {
  const strip = (p: any) => { const { initial, animate, exit, transition, whileTap, whileHover, layout, ...r } = p; return r; };
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef((p: any, ref) => React.createElement(tag, { ...strip(p), ref })) });
  return { motion, AnimatePresence: ({ children }: any) => <>{children}</> };
});
vi.mock("@/hooks/useYouTubeVideoProgress", () => ({ useYouTubeVideoProgress: () => ({ saveProgress: vi.fn(), getProgress: () => 0 }) }));

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
import { KidsEnhancedYouTubePlayer } from "@/components/kids/KidsEnhancedYouTubePlayer";

let events: any;
const target = { getDuration: () => 300, getVolume: () => 100, playVideo: vi.fn(), pauseVideo: vi.fn(), getCurrentTime: () => 5, destroy: vi.fn(), mute: vi.fn(), unMute: vi.fn(), seekTo: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  (window as any).YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
    Player: function (_id: string, opts: any) { events = opts.events; return target; },
  };
});
afterEach(() => vi.useRealTimers());
const state = async (d: number) => { await act(async () => { events.onStateChange({ data: d, target }); }); };
const tick = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

describe("KidsEnhancedYouTubePlayer controls", () => {
  it("hides + disables controls while playing; restores on pause; center Play only when paused", async () => {
    render(<KidsEnhancedYouTubePlayer videoId="abc" title="Kids" onClose={vi.fn()} />);
    await tick(200);
    await act(async () => { events.onReady({ target }); });
    await state(1);
    expect(screen.queryByTestId("kids-center-play")).toBeNull();
    await tick(4100);
    const header = screen.getByTestId("kids-header");
    const controls = screen.getByTestId("kids-controls");
    expect(header.className).toContain("pointer-events-none");
    expect(header.hasAttribute("inert")).toBe(true);
    expect(controls.className).toContain("pointer-events-none");
    await state(2);
    expect(screen.getByTestId("kids-header").className).not.toContain("pointer-events-none");
    expect(screen.getByTestId("kids-controls").className).toContain("pointer-events-auto");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });
});
