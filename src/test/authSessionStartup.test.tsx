import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authListeners: Array<(event: string, session: any) => void> = [];
const session = {
  user: {
    id: "user-1",
    email: "user@hoyeeh.com",
  },
};

const rpc = vi.fn(async (fn: string) => {
  if (fn === "generate_secure_session_id") {
    return { data: "session-1", error: null };
  }

  if (fn === "validate_session") {
    return { data: true, error: null };
  }

  if (fn === "clear_session") {
    return { data: null, error: null };
  }

  return { data: null, error: null };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/components/auth/SessionConflictDialog", () => ({
  SessionConflictDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="session-conflict">Session conflict</div> : null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    auth: {
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        authListeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      },
      getSession: vi.fn(async () => ({ data: { session } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    channel: vi.fn(() => {
      const channelApi = {
        on: vi.fn(() => channelApi),
        subscribe: vi.fn(() => channelApi),
      };

      return channelApi;
    }),
    removeChannel: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function AuthProbe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user?.id ?? "no-user"}</div>;
}

describe("AuthProvider startup session sync", () => {
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;

  beforeEach(() => {
    authListeners.length = 0;
    rpc.mockClear();
    localStorage.clear();
    vi.useFakeTimers();
    window.setInterval = vi.fn(() => 1 as any) as any;
    window.clearInterval = vi.fn() as any;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
  });

  it("generates a secure session once when auth restores and sign-in fire together", async () => {
    render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      authListeners.forEach((listener) => listener("SIGNED_IN", session));
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    const generateCalls = rpc.mock.calls.filter(([fn]) => fn === "generate_secure_session_id");

    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(generateCalls).toHaveLength(1);
    expect(screen.queryByTestId("session-conflict")).not.toBeInTheDocument();
  });
});