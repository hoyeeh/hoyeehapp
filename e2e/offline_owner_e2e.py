"""
Browser E2E for on-device offline downloads (dev server, real Chromium, real IndexedDB).

The entitlement proxy is replaced by a local route that serves e2e/fixtures/fixture.webm
with real HTTP Range semantics, so the flow is repeatable without touching production data.

Checks: resumable download (interrupted mid-file, resumed via 206) -> verified complete ->
network OFF -> new tab cold start with EXPIRED access token -> play -> seek -> reload resumes
position -> profile switch hides the file and stops playback -> switch back -> delete -> gone.

Run:  python3 e2e/offline_owner_e2e.py   (dev server on http://localhost:8080)
Screenshots: /tmp/browser/offline_e2e/
"""
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
FIX = (Path(__file__).parent / "fixtures" / "fixture.webm").read_bytes()
OUT = Path("/tmp/browser/offline_e2e"); OUT.mkdir(parents=True, exist_ok=True)
CID = "00000000-0000-4000-8000-00000000e2e1"
KEY = "sb-astugmzoxhxcyipxsojl-auth-token"
# Fake, already-EXPIRED session: only the user id matters for offline ownership.
SESSION = {"access_token": "expired", "refresh_token": "none", "expires_at": 1, "token_type": "bearer",
           "user": {"id": "e2e-user-a", "aud": "authenticated"}}
results = []
def check(name, ok):
    results.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        state = {"cut": True, "ranges": []}

        async def serve(route):
            rng = route.request.headers.get("range")
            start = int(re.match(r"bytes=(\d+)-", rng).group(1)) if rng else 0
            state["ranges"].append(start)
            body = FIX[start:]
            if state["cut"] and start == 0:
                body = FIX[:len(FIX) // 2]; state["cut"] = False  # simulate dropped connection
            headers = {"content-type": "video/webm", "accept-ranges": "bytes", "etag": '"fx1"',
                       "content-length": str(len(FIX) - start), "access-control-allow-origin": "*"}
            if start: headers["content-range"] = f"bytes {start}-{len(FIX)-1}/{len(FIX)}"
            await route.fulfill(status=206 if start else 200, headers=headers, body=body)
        await ctx.route("**/e2e-fixture-proxy", serve)
        # Backend unreachable for the whole run (fake session can never be refreshed; a network
        # failure must not sign the user out of their offline library).
        await ctx.route("**/*.supabase.co/**", lambda r: r.abort("internetdisconnected"))

        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(f"localStorage.setItem({json.dumps(KEY)}, {json.dumps(json.dumps(SESSION))}); localStorage.setItem('hoyeeh_current_profile','p1')")

        dl = """async ({cid}) => {
          const eng = await import('/src/services/offlineDownloadEngine.ts');
          const open = (start, signal) => fetch('/e2e-fixture-proxy', {headers: start ? {Range: `bytes=${start}-`} : {}, signal});
          const go = () => eng.downloadToDevice({contentId: cid, meta: {title: 'E2E fixture'}, openRange: open, chunkSize: 4096});
          let first = 'ok';
          try { await go(); } catch (e) { first = e.code; }
          const m = await go();
          return {first, status: m.status, size: m.size};
        }"""
        r = await page.evaluate(dl, {"cid": CID})
        check("interrupted download reports INCOMPLETE", r["first"] == "INCOMPLETE")
        check("resume used a Range request from the saved offset", any(s > 0 for s in state["ranges"]))
        check("download verified complete with exact size", r["status"] == "complete" and r["size"] == len(FIX))

        # Backend unreachable (airplane mode for the app's API). The dev server itself must stay
        # up to serve modules; true full-offline cold start is covered on the built app + SW.
        p2 = await ctx.new_page()
        await p2.goto(f"{BASE}/offline-play/{CID}", wait_until="domcontentloaded")
        v = p2.get_by_test_id("offline-video")
        await v.wait_for(timeout=20000)
        await p2.wait_for_function("document.querySelector('[data-testid=offline-video]').readyState >= 1", timeout=15000)
        await p2.evaluate("(async()=>{const v=document.querySelector('[data-testid=offline-video]');v.muted=true;await v.play().catch(()=>{});})()")
        await p2.wait_for_timeout(1200)
        t = await p2.evaluate("document.querySelector('[data-testid=offline-video]').currentTime")
        check("plays offline with expired token (cold tab)", t > 0)
        await p2.evaluate("(()=>{const v=document.querySelector('[data-testid=offline-video]');v.currentTime=3;})()")
        await p2.wait_for_timeout(800)
        seek = await p2.evaluate("document.querySelector('[data-testid=offline-video]').currentTime")
        check("seek works on local file", seek >= 2.9)
        await p2.evaluate("document.querySelector('[data-testid=offline-video]').pause()")
        await p2.screenshot(path=str(OUT / "1_playing_offline.png"))
        pos = await p2.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('hoyeeh_offline_pos:'))")
        check("resume position key is scoped to account+profile", any("e2e-user-a|p1" in k for k in pos))

        await p2.reload(wait_until="domcontentloaded")
        await p2.get_by_test_id("offline-video").wait_for(timeout=20000)
        await p2.wait_for_function("document.querySelector('[data-testid=offline-video]').readyState >= 1", timeout=15000)
        await p2.wait_for_timeout(500)
        resumed = await p2.evaluate("document.querySelector('[data-testid=offline-video]').currentTime")
        check("offline reload resumes near saved position", resumed >= 2)

        # Profile switch: signal owner change -> playback must stop, file must not resolve.
        await p2.evaluate("""async () => { localStorage.setItem('hoyeeh_current_profile','p2');
          const s = await import('/src/services/offlineStorage.ts'); s.invalidateOfflineOwner(); }""")
        await p2.get_by_text("This download isn't available on this device.").wait_for(timeout=10000)
        check("profile switch stops playback and hides other profile's file", await p2.get_by_test_id("offline-video").count() == 0)
        await p2.screenshot(path=str(OUT / "2_other_profile.png"))

        await p2.evaluate("""async (cid) => { localStorage.setItem('hoyeeh_current_profile','p1');
          const s = await import('/src/services/offlineStorage.ts'); s.invalidateOfflineOwner();
          await s.deleteDownload(cid); }""", CID)
        await p2.reload(wait_until="domcontentloaded")
        await p2.get_by_text("This download isn't available on this device.").wait_for(timeout=10000)
        check("deleted download is no longer playable", True)
        await p2.screenshot(path=str(OUT / "3_deleted.png"))
        await b.close()
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results)-len(failed)}/{len(results)} passed")
    raise SystemExit(1 if failed else 0)

asyncio.run(main())
