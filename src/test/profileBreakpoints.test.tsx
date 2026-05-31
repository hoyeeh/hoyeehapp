import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Mock all heavy dependencies before importing Profile
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@hoyeeh.com" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfileContext: () => ({
    currentProfile: { id: "p1", name: "Test", is_kids: false, avatar_url: null },
    setCurrentProfile: vi.fn(),
    profiles: [],
  }),
}));

vi.mock("@/hooks/useDatabase", () => ({
  useProfile: () => ({
    data: {
      id: "test-user",
      display_name: "Test User",
      country: "CM",
      avatar_url: null,
      is_subscribed: false,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCreator", () => ({
  useIsCreator: () => ({ data: false }),
}));

vi.mock("@/hooks/useAdmin", () => ({
  useIsAdmin: () => ({ data: false }),
}));

vi.mock("@/hooks/usePendingPurchaseVerification", () => ({
  useRestorePurchases: () => ({ restorePurchases: vi.fn() }),
}));

vi.mock("@/hooks/usePaidContent", () => ({
  useUserPurchases: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));

// Mock the heavy mobile profile to avoid pulling in its tree
vi.mock("@/components/mobile/MobileProfile", () => ({
  MobileProfile: () => <div data-testid="mobile-profile">Mobile Profile View</div>,
}));

import Profile from "@/pages/Profile";

const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: width < 768,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
  window.dispatchEvent(new Event("resize"));
};

const renderProfile = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/profile"]}>
          <ErrorBoundary>
            <Profile />
          </ErrorBoundary>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe("Profile page across breakpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setViewport(1280);
  });

  it("renders the desktop Profile page without crashing at 1280px", () => {
    setViewport(1280);
    renderProfile();
    // Desktop view shows the "Profile Details" card heading
    expect(screen.getByText(/Profile Details/i)).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-profile")).not.toBeInTheDocument();
  });

  it("renders the MobileProfile component at 375px", () => {
    setViewport(375);
    renderProfile();
    expect(screen.getByTestId("mobile-profile")).toBeInTheDocument();
  });

  it("does not throw a Rules-of-Hooks error when switching breakpoints", () => {
    setViewport(1280);
    const { rerender } = renderProfile();
    expect(screen.getByText(/Profile Details/i)).toBeInTheDocument();

    // Flip to mobile and re-render — the previous bug caused a hook-order
    // mismatch here. With the fix, this rerender must not throw.
    act(() => setViewport(375));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(() =>
      rerender(
        <HelmetProvider>
          <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={["/profile"]}>
              <ErrorBoundary>
                <Profile />
              </ErrorBoundary>
            </MemoryRouter>
          </QueryClientProvider>
        </HelmetProvider>
      )
    ).not.toThrow();
  });
});
