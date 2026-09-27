import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { ProfileContext } from "@/contexts/ProfileContext";
import { MobileVideoPlayerProvider, useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";

// Title page / episode entries (MobileContentDetail, ContentDetail phone paths) call
// openPlayer WITHOUT kids flags; the provider must derive them from the active profile.
const content: any = { id: "c1", title: "T", contentType: "series", isPremium: false };
const ep = (id: string) => ({ id, title: id, video_url: `https://cdn.hoyeeh.com/${id}.mp4` }) as any;

function wrap(profile: any) {
  return ({ children }: { children: React.ReactNode }) => (
    <ProfileContext.Provider value={{ currentProfile: profile } as any}>
      <MobileVideoPlayerProvider>{children}</MobileVideoPlayerProvider>
    </ProfileContext.Provider>
  );
}
const open = (r: any) => act(() => r.current.openPlayer({
  content, videoUrl: "https://cdn.hoyeeh.com/e1.mp4", title: "T", episodeId: "e1",
  hasNextEpisode: true, nextEpisode: ep("e2"), allEpisodes: [ep("e1"), ep("e2"), ep("e3")],
}));

describe("Kids flags on detail/episode entry", () => {
  it("Kids profile: detail entry without flags still opens in Kids mode with the profile id", () => {
    const { result } = renderHook(() => useMobileVideoPlayer(), { wrapper: wrap({ id: "kid-1", is_kids: true }) });
    open(result);
    expect(result.current.playerState.isKidsMode).toBe(true);
    expect(result.current.playerState.kidsProfileId).toBe("kid-1");
  });

  it("next episode keeps Kids flags", () => {
    const { result } = renderHook(() => useMobileVideoPlayer(), { wrapper: wrap({ id: "kid-1", is_kids: true }) });
    open(result);
    act(() => result.current.playNextEpisode());
    expect(result.current.playerState.episodeId).toBe("e2");
    expect(result.current.playerState.isKidsMode).toBe(true);
    expect(result.current.playerState.kidsProfileId).toBe("kid-1");
  });

  it("main profile stays non-Kids and cannot inherit a stray kids id", () => {
    const { result } = renderHook(() => useMobileVideoPlayer(), { wrapper: wrap({ id: "adult", is_kids: false }) });
    act(() => result.current.openPlayer({ content, videoUrl: "u", title: "T", kidsProfileId: "kid-x" } as any));
    expect(result.current.playerState.isKidsMode).toBe(false);
    expect(result.current.playerState.kidsProfileId).toBeUndefined();
  });
});
