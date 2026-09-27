import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Race regression: the episode URL autoplay effect used to mark the attempt
// before the episode list finished loading, then silently return on mobile
// when allEpisodes was still empty — the episode never opened.

const openPlayer = vi.fn();
vi.mock("@/contexts/MobileVideoPlayerContext", () => ({
  useMobileVideoPlayer: () => ({ openPlayer, playerState: { isOpen: false }, closePlayer: vi.fn() }),
  MobileVideoPlayerProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/useMobileDevice", () => ({
  useMobileDevice: () => ({ isMobileDevice: true, isTablet: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: null }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfileContext: () => ({ currentProfile: null }),
  ProfileContext: React.createContext(null),
}));

vi.mock("@/hooks/useDatabase", () => ({
  useContent: () => ({
    data: [{
      id: "c1",
      title: "Series",
      contentType: "series",
      isPremium: false,
      videoUrl: "",
      thumbnailUrl: "",
    }],
    isLoading: false,
  }),
  useWatchlist: () => ({ data: [] }),
  useAddToWatchlist: () => ({ mutate: vi.fn() }),
  useRemoveFromWatchlist: () => ({ mutate: vi.fn() }),
  useProfile: () => ({ data: { is_subscribed: true } }),
}));

vi.mock("@/hooks/useSeasons", () => ({
  useSeasons: () => ({ data: [] }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const episodesRow = {
    id: "e1",
    title: "Pilot",
    episode_number: 1,
    video_url: "https://cdn.hoyeeh.com/e1.mp4",
    is_premium: false,
  };
  const seasonsRows = [{ id: "s1", season_number: 1 }];
  const makeQuery = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: async () =>
        table === "episodes" ? { data: episodesRow, error: null } : { data: null, error: null },
      then: undefined,
    };
    // await q (seasons / episode list queries resolve via thenable)
    q.then = (resolve: any) =>
      resolve(
        table === "seasons"
          ? { data: seasonsRows }
          : { data: [episodesRow] }
      );
    return q;
  };
  return {
    supabase: {
      from: (table: string) => makeQuery(table),
      functions: { invoke: async () => ({ data: null, error: new Error("skip") }) },
    },
  };
});

vi.mock("@/components/mobile/MobileContentDetail", () => ({
  default: () => <div data-testid="mobile-detail">detail</div>,
}));

vi.mock("@/components/cast/UniversalCastButton", () => ({
  UniversalCastButton: () => null,
  default: () => null,
}));

import ContentDetail from "@/pages/ContentDetail";

describe("episode URL autoplay race", () => {
  beforeEach(() => openPlayer.mockClear());

  it("opens the episode once the episode list finishes loading", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/content/c1?episode=e1&autoplay=true"]}>
          <Routes>
            <Route path="/content/:id" element={<ContentDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(openPlayer).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const arg = openPlayer.mock.calls[0][0];
    expect(arg.episodeId).toBe("e1");
    expect(arg.videoUrl).toBe("https://cdn.hoyeeh.com/e1.mp4");
    expect(arg.allEpisodes.length).toBeGreaterThan(0);
  });
});
