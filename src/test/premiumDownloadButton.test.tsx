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

describe("mobile episode downloads use parent + episode ids", () => {
  const PARENT = "11111111-1111-4111-8111-111111111111";
  const EP = "22222222-2222-4222-8222-222222222222";
  const mp4 = () => {
    const b = new Uint8Array(4000);
    b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
    return b;
  };

  it("sends both UUIDs, stores under parent__episode, lists it and plays via ?episode=", async () => {
    const bytes = mp4();
    fetchMock.mockImplementation(async () => new Response(bytes as unknown as BodyInit, {
      status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytes.length) },
    }));
    render(<OfflineDownloadButton contentId={PARENT} episodeId={EP} title="Show — E1" poster="" duration={60} hasSource />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /download/i })); });
    await waitFor(() => expect(screen.getByText(/downloaded/i)).toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ contentId: PARENT, episodeId: EP });
    expect(store.map.has(`m:u1|p1:${PARENT}__${EP}`)).toBe(true);
    expect([...store.map.keys()].some((k) => k.includes(`${PARENT}_${EP}`) && !k.includes("__"))).toBe(false);

    const { getAllDownloads } = await import("@/services/offlineStorage");
    const list = await getAllDownloads();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ contentId: PARENT, episodeId: EP });

    // Offline player resolves the same key from the route + ?episode= query.
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local", revokeObjectURL: () => {} }));
    const { MemoryRouter, Routes, Route } = await import("react-router-dom");
    const { default: OfflinePlayer } = await import("@/pages/OfflinePlayer");
    const { container } = render(
      <MemoryRouter initialEntries={[`/offline-play/${PARENT}?episode=${EP}`]}>
        <Routes><Route path="/offline-play/:contentId" element={<OfflinePlayer />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.querySelector("video")?.getAttribute("src")).toBe("blob:local"));
  });

  it("shows a clear refusal when the server rejects an episode from another title (404)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    render(<OfflineDownloadButton contentId={PARENT} episodeId={EP} title="Show — E9" poster="" duration={60} hasSource />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /download/i })); });
    await waitFor(() => expect(screen.getByText(/isn't available for download/i)).toBeInTheDocument());
    expect([...store.map.keys()].some((k) => k.startsWith("c:"))).toBe(false);
  });
});
