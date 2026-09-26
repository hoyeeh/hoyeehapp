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

describe("owner isolation and lifecycle (review 10b9819)", () => {
  const meta = { title: "Fixture" };

  it("does not share an in-flight download across owners", async () => {
    const bytes = fixture(20_000);
    const a = server(bytes); const b = server(bytes);
    const pa = downloadToDevice({ contentId: "c1", meta, openRange: a.open, chunkSize: 4096 });
    await new Promise((r) => setTimeout(r, 0));
    owner = "user-b|profile-1";
    const pb = downloadToDevice({ contentId: "c1", meta, openRange: b.open, chunkSize: 4096 });
    expect(pb).not.toBe(pa);
    await pb;
    expect(b.calls.length).toBeGreaterThan(0);
    expect(await getManifest("c1", "user-b|profile-1")).toMatchObject({ status: "complete", owner: "user-b|profile-1" });
    await pa.catch(() => {});
  });

  it("owner change mid-download stops writes and leaves nothing for the old owner", async () => {
    const { invalidateOfflineOwner } = await import("@/services/offlineStorage");
    const bytes = fixture(40_000);
    let started = false;
    const slow: OpenRange = async () => {
      const stream = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          if (!started) { started = true; ctrl.enqueue(bytes.slice(0, 8192)); return; }
          invalidateOfflineOwner(); // logout happens while bytes are arriving
          owner = "user-b|profile-1";
          ctrl.enqueue(bytes.slice(8192)); ctrl.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytes.length) } });
    };
    await expect(downloadToDevice({ contentId: "c2", meta, openRange: slow, chunkSize: 4096 }))
      .rejects.toMatchObject({ code: "AUTH" });
    const leftovers = [...store.map.keys()].filter((k) => k.includes("user-a|profile-1") && k.includes("c2"));
    expect(leftovers).toEqual([]);
  });

  it("re-downloads instead of trusting an expired or corrupted complete manifest", async () => {
    const bytes = fixture(10_000);
    const s1 = server(bytes);
    const m = await downloadToDevice({ contentId: "c3", meta, openRange: s1.open });
    await store.setItem(`m:${owner}:c3`, { ...m, expiresAt: Date.now() - 1 });
    const s2 = server(bytes);
    const again = await downloadToDevice({ contentId: "c3", meta, openRange: s2.open });
    expect(s2.calls).toEqual([0]);
    expect(again.expiresAt).toBeGreaterThan(Date.now());

    await store.removeItem(`c:${owner}:c3:0`); // evicted bytes
    const s3 = server(bytes);
    await downloadToDevice({ contentId: "c3", meta, openRange: s3.open });
    expect(s3.calls).toEqual([0]);
    expect(await getDownload("c3")).not.toBeNull();
  });
});

describe("independent regressions at 10b9819", () => {
  const meta = { title: "Fixture" };
  const counting = (bytes: Uint8Array) => { const s = server(bytes); return s; };

  it("(1) expired complete manifest triggers a real re-download", async () => {
    const bytes = fixture(12_000);
    await downloadToDevice({ contentId: "r1", meta, openRange: counting(bytes).open });
    const m = await getManifest("r1", owner);
    await store.setItem(`m:${owner}:r1`, { ...m!, expiresAt: Date.now() - 1000 });
    const s = counting(bytes);
    const again = await downloadToDevice({ contentId: "r1", meta, openRange: s.open });
    expect(s.calls.length).toBeGreaterThan(0);
    expect(again.expiresAt).toBeGreaterThan(Date.now());
    const d = await getDownload("r1");
    expect(new Uint8Array(await d!.blob.arrayBuffer())).toEqual(bytes);
  });

  it("(2) missing chunks after complete are repaired", async () => {
    const bytes = fixture(12_000);
    await downloadToDevice({ contentId: "r2", meta, openRange: counting(bytes).open, chunkSize: 4096 });
    for (const k of [...store.map.keys()]) if (k.startsWith(`c:${owner}:r2:`)) store.map.delete(k);
    expect(await getDownload("r2")).toBeNull();
    const s = counting(bytes);
    await downloadToDevice({ contentId: "r2", meta, openRange: s.open, chunkSize: 4096 });
    expect(s.calls).toEqual([0]);
    const d = await getDownload("r2");
    expect(new Uint8Array(await d!.blob.arrayBuffer())).toEqual(bytes);
  });

  it("(3) logout + purge while response is pending leaves the old user's store empty", async () => {
    const bytes = fixture(12_000);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const deferred: OpenRange = async () => {
      await gate;
      return new Response(bytes as unknown as BodyInit, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytes.length) } });
    };
    const p = downloadToDevice({ contentId: "r3", meta, openRange: deferred, chunkSize: 4096 });
    await new Promise((r) => setTimeout(r, 0));
    let cur: string | null = owner;
    __setOfflineStoreForTests(store, async () => cur);
    cur = null;
    await purgeUserDownloads("user-a");
    release();
    await expect(p).rejects.toMatchObject({ code: "AUTH" });
    expect([...store.map.keys()].filter((k) => k.includes("user-a|"))).toEqual([]);
  });

  it("(4) concurrent in-flight download of same title under A then B never hands A's manifest to B", async () => {
    const bytesA = fixture(12_000);
    const bytesB = fixture(9_000);
    let releaseA!: () => void;
    const gateA = new Promise<void>((r) => (releaseA = r));
    const openA: OpenRange = async () => {
      await gateA;
      return new Response(bytesA as unknown as BodyInit, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(bytesA.length) } });
    };
    const pa = downloadToDevice({ contentId: "r4", meta, openRange: openA, chunkSize: 4096 });
    await new Promise((r) => setTimeout(r, 0));
    owner = "user-b|profile-1";
    const sb = server(bytesB);
    const mb = await downloadToDevice({ contentId: "r4", meta, openRange: sb.open, chunkSize: 4096 });
    expect(sb.calls.length).toBeGreaterThan(0);
    expect(mb.owner).toBe("user-b|profile-1");
    releaseA();
    const ma = await pa.catch(() => null);
    if (ma) expect(ma.owner).toBe("user-a|profile-1");
    expect((await getManifest("r4", "user-b|profile-1"))!.owner).toBe("user-b|profile-1");
    const d = await getDownload("r4");
    expect(new Uint8Array(await d!.blob.arrayBuffer())).toEqual(bytesB);
  });
});
