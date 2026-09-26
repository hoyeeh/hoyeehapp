"""
Offline E2E against the LIVE published site (default https://hoyeeh.com), real Chromium,
real service worker, real IndexedDB, and TRUE airplane mode (browser context set offline).

Production builds don't expose source modules, so the script seeds the app's own offline
store (IndexedDB "StreamingApp"/"offline_videos_v2", same key format the download engine
writes) with e2e/fixtures/fixture.webm, then drives the live UI. The resumable download
engine itself is covered by `npx vitest run` and e2e/offline_owner_e2e.py (dev server).

Checks: SW controls the page -> seeded verified download -> airplane mode -> cold-start tab
with EXPIRED sign-in -> Downloads list shows it -> play -> seek -> reload resumes -> profile
switch hides it and stops playback -> missing chunk fails closed -> delete -> gone.

Run:  python3 e2e/offline_live_e2e.py        (E2E_BASE=https://www.hoyeeh.com to override)
Screenshots: /tmp/browser/offline_live_e2e/
Uses only a fake local user id; never touches real accounts or backend data.
"""
import asyncio, base64, json, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "https://hoyeeh.com").rstrip("/")
FIX = (Path(__file__).parent / "fixtures" / "fixture.webm").read_bytes()
OUT = Path("/tmp/browser/offline_live_e2e"); OUT.mkdir(parents=True, exist_ok=True)
CID = "00000000-0000-4000-8000-00000000e2e2"
KEY = "sb-astugmzoxhxcyipxsojl-auth-token"
USER = "e2e-live-user"
OWNER = f"{USER}|p1"
SESSION = {"access_token": "expired", "refresh_token": "none", "expires_at": 1, "token_type": "bearer",
           "user": {"id": USER, "aud": "authenticated"}}
VID = "[data-testid=offline-video]"
GONE = "This download isn't available on this device."
results = []
def check(name, ok):
    results.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name, flush=True)

IDB = """async ({op, owner, cid, b64, chunks, drop}) => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('StreamingApp');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await open();
  if (!db.objectStoreNames.contains('offline_videos_v2')) { db.close(); return 'NO_STORE'; }
  const tx = db.transaction('offline_videos_v2', 'readwrite'); const st = tx.objectStore('offline_videos_v2');
  if (op === 'seed') {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const size = Math.ceil(bytes.length / chunks); const sizes = [];
    for (let i = 0; i < chunks; i++) { const b = new Blob([bytes.slice(i*size, (i+1)*size)], {type: 'video/webm'});
      sizes.push(b.size); st.put(b, `c:${owner}:${cid}:${i}`); }
    const now = Date.now();
    st.put({contentId: cid, owner, title: 'E2E live fixture', savedAt: now, updatedAt: now,
      expiresAt: now + 86400000, status: 'complete', totalBytes: bytes.length, receivedBytes: bytes.length,
      size: bytes.length, chunkCount: chunks, chunkSizes: sizes, mimeType: 'video/webm'}, `m:${owner}:${cid}`);
  } else if (op === 'drop') { st.delete(`c:${owner}:${cid}:${drop}`); }
  else if (op === 'purge') { const ks = await new Promise(r => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); });
    ks.filter(k => String(k).includes(cid)).forEach(k => st.delete(k)); }
  else if (op === 'keys') { const ks = await new Promise(r => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); });
    db.close(); return ks.filter(k => String(k).includes(cid)); }
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close(); return 'ok';
}"""

async def wait_video(pg):
    await pg.locator(VID).wait_for(timeout=25000)
    await pg.wait_for_function(f"document.querySelector('{VID}')?.readyState >= 1", timeout=20000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        # The fake session can't be refreshed; keep the backend away so it isn't wiped online.
        await ctx.route("**/*.supabase.co/**", lambda r: r.abort("internetdisconnected"))
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(f"localStorage.setItem({json.dumps(KEY)}, {json.dumps(json.dumps(SESSION))}); localStorage.setItem('hoyeeh_current_profile','p1')")

        # 1. Service worker installed and controlling, shell precached.
        await page.evaluate("navigator.serviceWorker.ready")
        await page.goto(f"{BASE}/offline-downloads", wait_until="networkidle")
        controlled = await page.evaluate("!!navigator.serviceWorker.controller")
        if not controlled:
            await page.reload(wait_until="networkidle")
            controlled = await page.evaluate("!!navigator.serviceWorker.controller")
        check("service worker controls the live page", controlled)
        sw = await page.evaluate("navigator.serviceWorker.controller?.scriptURL || ''")
        print("  sw:", sw)
        await page.wait_for_timeout(3000)  # let precache finish

        # 2. Seed a verified download in the app's own store (store created by the live app).
        seeded = "NO_STORE"
        for _ in range(20):
            seeded = await page.evaluate(IDB, {"op": "seed", "owner": OWNER, "cid": CID,
                                               "b64": base64.b64encode(FIX).decode(), "chunks": 3, "drop": 0})
            if seeded == "ok": break
            await page.wait_for_timeout(500)
        check("live app created its offline store and download was seeded", seeded == "ok")

        # 3. Airplane mode, cold-start tab.
        await ctx.set_offline(True)
        await page.close()
        p2 = await ctx.new_page()
        try:
            await p2.goto(f"{BASE}/offline-downloads", wait_until="domcontentloaded", timeout=20000)
            await p2.get_by_text("E2E live fixture").first.wait_for(timeout=20000)
            listed = True
        except Exception as e:
            print("  list error:", e); listed = False
        await p2.screenshot(path=str(OUT / "1_list_offline.png"))
        check("airplane-mode cold start lists the download (expired sign-in)", listed)

        try:
            await p2.goto(f"{BASE}/offline-play/{CID}", wait_until="domcontentloaded", timeout=20000)
            await wait_video(p2)
            await p2.evaluate(f"(async()=>{{const v=document.querySelector('{VID}');v.muted=true;await v.play().catch(()=>{{}});}})()")
            await p2.wait_for_timeout(1500)
            t = await p2.evaluate(f"document.querySelector('{VID}').currentTime")
        except Exception as e:
            print("  play error:", e); t = 0
        check("plays offline from device storage", t > 0)

        if t > 0:
            await p2.evaluate(f"document.querySelector('{VID}').currentTime=3")
            await p2.wait_for_timeout(1000)
            seek = await p2.evaluate(f"document.querySelector('{VID}').currentTime")
            check("seek works on local file", seek >= 2.9)
            await p2.evaluate(f"document.querySelector('{VID}').pause()")
            await p2.wait_for_timeout(1500)
            await p2.screenshot(path=str(OUT / "2_playing_offline.png"))
            pos = await p2.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('hoyeeh_offline_pos:'))")
            check("resume position scoped to account+profile", any(OWNER in k for k in pos))
            await p2.reload(wait_until="domcontentloaded")
            await wait_video(p2); await p2.wait_for_timeout(700)
            resumed = await p2.evaluate(f"document.querySelector('{VID}').currentTime")
            check("offline reload resumes near saved position", resumed >= 2)

            # Profile switch (same signal the app fires) must stop playback and hide the file.
            await p2.evaluate("localStorage.setItem('hoyeeh_current_profile','p2'); window.dispatchEvent(new Event('hoyeeh-offline-owner-change'))")
            try:
                await p2.get_by_text(GONE).wait_for(timeout=10000); hidden = await p2.locator(VID).count() == 0
            except Exception: hidden = False
            await p2.screenshot(path=str(OUT / "3_other_profile.png"))
            check("profile switch stops playback and hides the file", hidden)
            await p2.evaluate("localStorage.setItem('hoyeeh_current_profile','p1')")

        # Integrity: a missing piece must fail closed, never play a truncated file.
        await p2.evaluate(IDB, {"op": "drop", "owner": OWNER, "cid": CID, "b64": "", "chunks": 0, "drop": 1})
        await p2.goto(f"{BASE}/offline-play/{CID}", wait_until="domcontentloaded")
        try: await p2.get_by_text(GONE).wait_for(timeout=10000); closed = True
        except Exception: closed = False
        check("missing chunk fails closed (not playable)", closed)

        # Delete: nothing left for this title.
        await p2.evaluate(IDB, {"op": "purge", "owner": OWNER, "cid": CID, "b64": "", "chunks": 0, "drop": 0})
        await p2.reload(wait_until="domcontentloaded")
        try: await p2.get_by_text(GONE).wait_for(timeout=10000); gone = True
        except Exception: gone = False
        left = await p2.evaluate(IDB, {"op": "keys", "owner": OWNER, "cid": CID, "b64": "", "chunks": 0, "drop": 0})
        await p2.screenshot(path=str(OUT / "4_deleted.png"))
        check("deleted download is gone and unplayable", gone and not left)
        await b.close()
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results)-len(failed)}/{len(results)} passed against {BASE}")
    raise SystemExit(1 if failed else 0)

asyncio.run(main())
