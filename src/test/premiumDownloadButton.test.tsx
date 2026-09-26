import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/utils/storageQuota", () => ({ requestPersistentStorage: vi.fn(async () => true) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok", user: { id: "u1" } } } }) } },
}));

import { OfflineDownloadButton } from "@/components/OfflineDownloadButton";
import { __setOfflineStoreForTests, type KVStore } from "@/services/offlineStorage";

function memStore(): KVStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    async getItem<T>(k: string) { return (map.has(k) ? map.get(k) : null) as T | null; },
    async setItem<T>(k: string, v: T) { map.set(k, v); return v; },
    async removeItem(k: string) { map.delete(k); },
    async keys() { return [...map.keys()]; },
  };
}

const base = { contentId: "prem-1", title: "Premium Film", poster: "", duration: 60 };
let store: ReturnType<typeof memStore>;
const fetchMock = vi.fn();

beforeEach(() => {
  store = memStore();
  __setOfflineStoreForTests(store, async () => "u1|p1");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("offline download button follows server policy", () => {
  it("shows Download for premium/paid titles (no client-side entitlement gate)", () => {
    render(<OfflineDownloadButton {...base} hasSource />);
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("hides for real DRM titles and titles without a file", () => {
    const { container, rerender } = render(<OfflineDownloadButton {...base} hasSource requiresDrm />);
    expect(container).toBeEmptyDOMElement();
    rerender(<OfflineDownloadButton {...base} hasSource={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks the server by content id only and shows a clear message on 403, storing nothing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Subscription required" }), { status: 403 }));
    render(<OfflineDownloadButton {...base} hasSource />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /download/i })); });
    await waitFor(() => expect(screen.getByText(/active subscription or a purchase/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/download-video$/);
    expect(JSON.parse(init.body)).toEqual({ contentId: "prem-1" });
    expect([...store.map.keys()].some((k) => k.startsWith("c:"))).toBe(false);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
