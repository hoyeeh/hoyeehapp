"""
DEV-ONLY player E2E against the fixture harness at /__e2e/player (route exists only in `vite dev`).
Mounts the REAL live players with a local playable fixture (e2e/fixtures/player-fixture.webm):
  desktop      -> VideoPlayer                      (Index desktop path, main + Kids)   1280x720
  videojs      -> VideoJSPlayerWithWatchParty      (ContentDetail desktop non-premium)  1280x720
  mobile       -> MobileVideoPlayer isKidsMode=false (PWA main)                         390x844
  mobile-kids  -> MobileVideoPlayer isKidsMode=true  (PWA Kids)                         390x844
This is a fixture harness, NOT production navigation: no sign-in, no catalogue title, no route
selection logic in Index/ContentDetail is exercised. Run: python3 e2e/player_harness_e2e.py
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:8080")
SHOTS = "/tmp/browser/player_e2e"
os.makedirs(SHOTS, exist_ok=True)
# Known non-media noise in a signed-out sandbox (branding intro video on a remote CDN, anon DB reads).
ALLOWED = ("[LogoOpener]", "Failed to load resource", "status of 40", "Database error")

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

async def vstate(pg):
    return await pg.evaluate("""()=>{const v=document.querySelector('video');
      return v?{t:v.currentTime,paused:v.paused,err:v.error&&v.error.code}:null}""")

async def advancing(pg, secs=1.5):
    a = (await vstate(pg))["t"]; await pg.wait_for_timeout(int(secs*1000)); b = (await vstate(pg))["t"]
    return b > a + 0.5, a, b

async def run(browser, player, label, mobile):
    vp = {"width": 390, "height": 844} if mobile else {"width": 1280, "height": 720}
    ctx = await browser.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    await pg.goto(f"{BASE}/__e2e/player?player={player}")
    await pg.wait_for_function("()=>{const v=document.querySelector('video');return v&&v.currentTime>0.5}", timeout=20000)
    ok, a, b = await advancing(pg)
    check(f"{label}: plays, currentTime advances", ok, f"{a:.1f}->{b:.1f}")

    if player == "videojs":
        root = pg.locator(".video-js")
        await pg.mouse.move(640, 360); await pg.wait_for_timeout(300)
        await pg.mouse.move(5, 5); await pg.wait_for_timeout(4500)
        check(f"{label}: controls auto-hide while playing", "vjs-user-inactive" in (await root.get_attribute("class")))
        await pg.mouse.move(600, 280, steps=5); await pg.mouse.move(650, 320, steps=5); await pg.wait_for_timeout(400)
        check(f"{label}: controls reappear on interaction", "vjs-user-active" in (await root.get_attribute("class")))
        await pg.locator(".vjs-play-control").click()
        await pg.wait_for_timeout(300); s1 = await vstate(pg); await pg.wait_for_timeout(5000); s2 = await vstate(pg)
        check(f"{label}: pause stays paused", s1["paused"] and s2["paused"] and abs(s2["t"] - s1["t"]) < 0.1)
        check(f"{label}: controls stay visible while paused", "vjs-paused" in (await root.get_attribute("class")) and "vjs-user-inactive" not in (await root.get_attribute("class")))
        await pg.mouse.move(640, 700, steps=3); await pg.locator(".vjs-play-control").click()
        ok, a, b = await advancing(pg); check(f"{label}: resume advances", ok, f"{a:.1f}->{b:.1f}")
    else:
        center = pg.get_by_test_id("center-play-toggle")
        async def controls_visible():
            if mobile:
                return await pg.get_by_test_id("mobile-controls").count() > 0 and await center.count() > 0
            cls = await center.locator("xpath=ancestor::div[contains(@class,'transition-opacity')][1]").get_attribute("class")
            return "opacity-100" in cls
        if not mobile:
            await pg.mouse.move(640, 360); await pg.wait_for_timeout(200); await pg.mouse.move(5, 5)
        await pg.wait_for_timeout(6000)
        check(f"{label}: center control hides after inactivity while playing", not await controls_visible())
        await pg.screenshot(path=f"{SHOTS}/{player}_hidden.png")
        if mobile:
            await pg.touchscreen.tap(195, 300)
        else:
            await pg.mouse.move(640, 300)
        await pg.wait_for_timeout(500)
        check(f"{label}: controls reappear on tap/interaction", await controls_visible())
        check(f"{label}: center icon reads Pause while playing", await center.get_attribute("aria-label") == "Pause")
        await center.click(); await pg.wait_for_timeout(400)
        s1 = await vstate(pg); await pg.wait_for_timeout(6000); s2 = await vstate(pg)
        check(f"{label}: pause stays paused", s1["paused"] and s2["paused"] and abs(s2["t"] - s1["t"]) < 0.1, f"{s1['t']:.2f}/{s2['t']:.2f}")
        check(f"{label}: controls stay visible when paused, icon reads Play",
              await controls_visible() and await center.get_attribute("aria-label") == "Play")
        await pg.screenshot(path=f"{SHOTS}/{player}_paused.png")
        await center.click()
        ok, a, b = await advancing(pg); check(f"{label}: resume advances", ok, f"{a:.1f}->{b:.1f}")
        check(f"{label}: no tap-to-play fallback while playing", await pg.get_by_test_id("tap-to-play").count() == 0)

        if mobile:
            if not await controls_visible():
                await pg.touchscreen.tap(195, 300); await pg.wait_for_timeout(400)
            await pg.get_by_role("button", name="Cast to TV").first.click()
            dlg = pg.get_by_role("dialog")
            await dlg.wait_for(timeout=5000)
            check(f"{label}: Cast to TV popup opens", await dlg.is_visible())
            ok, a, b = await advancing(pg)
            check(f"{label}: phone keeps playing with popup open (no ACK yet)", ok and not (await vstate(pg))["paused"], f"{a:.1f}->{b:.1f}")
            await pg.screenshot(path=f"{SHOTS}/{player}_cast.png")

    st = await vstate(pg)
    check(f"{label}: no media element error", st["err"] is None)
    bad = [e for e in errors if not any(x in e for x in ALLOWED)]
    check(f"{label}: no unexpected console/page errors", not bad, "; ".join(bad)[:300])
    allowed = [e for e in errors if any(x in e for x in ALLOWED)]
    if allowed: print(f"     note {label}: {len(allowed)} allow-listed non-media errors, e.g. {allowed[0][:120]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        await run(b, "desktop", "Desktop VideoPlayer (Index main+Kids path) 1280x720", False)
        await run(b, "videojs", "Desktop VideoJS (ContentDetail non-premium) 1280x720", False)
        await run(b, "mobile", "PWA MobileVideoPlayer main 390x844", True)
        await run(b, "mobile-kids", "PWA MobileVideoPlayer Kids 390x844", True)
        await b.close()
    passed = sum(ok for _, ok in results)
    print(f"\n{passed}/{len(results)} checks passed")
    sys.exit(0 if passed == len(results) else 1)

asyncio.run(main())
