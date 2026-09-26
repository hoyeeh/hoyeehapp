import { beforeEach, describe, expect, it } from "vitest";
import {
  __setOfflineStoreForTests,
  deleteDownload,
  getAllDownloads,
  getDownload,
  getManifest,
  purgeUserDownloads,
  type KVStore,
} from "@/services/offlineStorage";
import { downloadToDevice, OfflineDownloadError, type OpenRange } from "@/services/offlineDownloadEngine";

// In-memory IndexedDB stand-in with real Blobs.
function memStore(): KVStore & { map: Map<string, unknown>; failWrites?: boolean } {
  const map = new Map<string, unknown>();
  const s = {
    map,
    failWrites: false,
    async getItem<T>(k: string) { return (map.has(k) ? map.get(k) : null) as T | null; },
    async setItem<T>(k: string, v: T) {
      if (s.failWrites && k.startsWith("c:")) throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      map.set(k, v); return v;
    },
    async removeItem(k: string) { map.delete(k); },
    async keys() { return [...map.keys()]; },
  };
  return s;
}

// Small lawful fixture: synthetic MP4 header ("ftyp") followed by deterministic bytes.
function fixture(size = 50_000): Uint8Array {
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = (i * 31) & 0xff;
  b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
  return b;
}

function server(bytes: Uint8Array, opts: { cutAt?: number; ignoreRange?: boolean; status?: number; type?: string } = {}) {
  const calls: number[] = [];
  const open: OpenRange = async (start) => {
    calls.push(start);
    if (opts.status) return new Response("{}", { status: opts.status });
    const from = opts.ignoreRange ? 0 : start;
    let body = bytes.slice(from);
    if (opts.cutAt !== undefined && calls.length === 1) body = bytes.slice(from, opts.cutAt);
    const headers: Record<string, string> = { "content-type": opts.type ?? "video/mp4", "content-length": String(bytes.length - from) };
    if (from > 0) headers["content-range"] = `bytes ${from}-${bytes.length - 1}/${bytes.length}`;
    return new Response(body, { status: from > 0 ? 206 : 200, headers });
  };
  return { open, calls };
}

let owner = "user-a|profile-1";
let store: ReturnType<typeof memStore>;
beforeEach(() => {
  store = memStore();
  owner = "user-a|profile-1";
  __setOfflineStoreForTests(store, async () => owner);
});

const meta = { title: "Fixture" };
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

describe("offline download engine", () => {
  it("stores the actual media bytes and plays back identical data", async () => {
    const src = fixture();
    const { open } = server(src);
    const m = await downloadToDevice({ contentId: "c1", meta, openRange: open, chunkSize: 8192 });
    expect(m.status).toBe("complete");
    expect(m.chunkCount).toBeGreaterThan(1);
    const got = await getDownload("c1");
    expect(got).not.toBeNull();
    expect(await bytesOf(got!.blob)).toEqual(src);
    // No URL persisted anywhere.
    expect(JSON.stringify([...store.map.entries()].filter(([k]) => k.startsWith("m:")))).not.toMatch(/https?:/);
  });

  it("resumes an interrupted download with a Range request", async () => {
    const src = fixture();
    const s = server(src, { cutAt: 20_000 });
    await expect(downloadToDevice({ contentId: "c2", meta, openRange: s.open, chunkSize: 4096 }))
      .rejects.toMatchObject({ code: "INCOMPLETE" });
    const partial = await getManifest("c2");
    expect(partial?.status).toBe("partial");
    expect(await getDownload("c2")).toBeNull(); // partial never playable
    await downloadToDevice({ contentId: "c2", meta, openRange: s.open, chunkSize: 4096 });
    expect(s.calls[1]).toBe(partial!.receivedBytes);
    expect(s.calls[1]).toBeGreaterThan(0);
    expect(await bytesOf((await getDownload("c2"))!.blob)).toEqual(src);
  });

  it("restarts cleanly if the server ignores Range", async () => {
    const src = fixture();
    await expect(downloadToDevice({ contentId: "c3", meta, openRange: server(src, { cutAt: 10_000 }).open, chunkSize: 4096 })).rejects.toThrow();
    await downloadToDevice({ contentId: "c3", meta, openRange: server(src, { ignoreRange: true }).open, chunkSize: 4096 });
    expect(await bytesOf((await getDownload("c3"))!.blob)).toEqual(src);
  });

  it("refuses HLS manifests, HTML error pages and non-video bytes", async () => {
    await expect(downloadToDevice({ contentId: "h", meta, openRange: server(fixture(), { type: "application/vnd.apple.mpegurl" }).open }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_SOURCE" });
    const junk = new TextEncoder().encode("#EXTM3U\n#EXT-X-VERSION:3\n" + "x".repeat(100));
    await expect(downloadToDevice({ contentId: "j", meta, openRange: server(junk).open }))
      .rejects.toMatchObject({ code: "CORRUPT" });
    expect(await getDownload("j")).toBeNull();
  });

  it("denies unauthorized / not-entitled responses without storing anything", async () => {
    await expect(downloadToDevice({ contentId: "p", meta, openRange: server(fixture(), { status: 403 }).open }))
      .rejects.toBeInstanceOf(OfflineDownloadError);
    expect(await getDownload("p")).toBeNull();
    expect([...store.map.keys()].some((k) => k.startsWith("c:"))).toBe(false);
  });

  it("reports quota errors clearly", async () => {
    store.failWrites = true;
    await expect(downloadToDevice({ contentId: "q", meta, openRange: server(fixture()).open, chunkSize: 4096 }))
      .rejects.toMatchObject({ code: "QUOTA" });
  });

  it("detects evicted/corrupted chunks and never returns a truncated file", async () => {
    await downloadToDevice({ contentId: "e", meta, openRange: server(fixture()).open, chunkSize: 4096 });
    store.map.delete([...store.map.keys()].find((k) => k.startsWith("c:") && k.endsWith(":2"))!);
    expect(await getDownload("e")).toBeNull();
  });

  it("de-duplicates concurrent downloads of the same title", async () => {
    const s = server(fixture());
    const [a, b] = await Promise.all([
      downloadToDevice({ contentId: "d", meta, openRange: s.open }),
      downloadToDevice({ contentId: "d", meta, openRange: s.open }),
    ]);
    expect(a).toBe(b);
    expect(s.calls.length).toBe(1);
  });

  it("separates accounts/profiles, expires, deletes and purges on logout", async () => {
    await downloadToDevice({ contentId: "x", meta, openRange: server(fixture()).open });
    owner = "user-a|profile-2";
    expect(await getDownload("x")).toBeNull();
    expect(await getAllDownloads()).toHaveLength(0);
    owner = "user-b|default";
    expect(await getDownload("x")).toBeNull();
    owner = "user-a|profile-1";
    expect(await getAllDownloads()).toHaveLength(1);

    const m = (await getManifest("x"))!;
    store.map.set(`m:${owner}:x`, { ...m, expiresAt: Date.now() - 1 });
    expect(await getDownload("x")).toBeNull();

    await downloadToDevice({ contentId: "y", meta, openRange: server(fixture()).open });
    await deleteDownload("y");
    expect(await getDownload("y")).toBeNull();

    await downloadToDevice({ contentId: "z", meta, openRange: server(fixture()).open });
    await purgeUserDownloads("user-a");
    expect([...store.map.keys()].filter((k) => k.includes("user-a|"))).toHaveLength(0);
  });
});
