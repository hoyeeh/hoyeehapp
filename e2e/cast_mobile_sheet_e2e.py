"""
Mobile "Cast to TV" popup E2E (two browser windows — NOT a physical TV test).

TV window: /tv-receiver/index.html shows a 6-char code.
Phone window (390x844, touch, signed in): opens the popup from the header
(device-management mode) and from a free title page (media mode), types the
TV code, and asserts success is shown only after the TV confirms the LOAD
(or an inline reason is shown if the TV refuses/cannot play it).

Env: E2E_BASE (default http://localhost:8080), E2E_CONTENT_ID (free movie id),
session from ~/.cache/lovable-auth/session.json (`lovable auth-session --json`).
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:8080")
CONTENT = os.environ.get("E2E_CONTENT_ID", "bb8122df-3d9d-4d58-96a3-ff322c14f769")
SHOTS = Path("/tmp/browser/cast_sheet_e2e"); SHOTS.mkdir(parents=True, exist_ok=True)
results = []
def check(n, ok, d=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + n + (f" — {d}" if d else ""), flush=True)

async def tv_code(tv):
    await tv.goto(f"{BASE}/tv-receiver/index.html")
    await tv.wait_for_function("/^[A-Z0-9]{6}$/.test(document.getElementById('pairingCode').textContent.trim())", timeout=30000)
    return (await tv.text_content("#pairingCode")).strip()

async def main():
    minted = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        tv = await (await b.new_context(viewport={"width": 1280, "height": 720})).new_page()
        ph_ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
            user_agent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")
        ph = await ph_ctx.new_page()
        await ph.goto(BASE)
        await ph.evaluate(f"localStorage.setItem({json.dumps(minted['storage_key'])}, {json.dumps(json.dumps(minted['session']))})")

        # --- 1. Header popup, device-management mode ---
        code = await tv_code(tv); check("TV shows code", True, code)
        await ph.goto(BASE); await ph.wait_for_timeout(4000)
        if "/profiles" in ph.url:
            await ph.get_by_text("kob", exact=True).first.click() if await ph.get_by_text("kob", exact=True).count() else ph.locator("img").first.click()
            await ph.wait_for_timeout(4000)
        await ph.get_by_role("button", name="Cast to device").first.click()
        dlg = ph.get_by_role("dialog", name="Cast to TV")
        await dlg.wait_for(timeout=10000)
        txt = await dlg.text_content()
        check("popup titled 'Cast to TV' with hoyeeh.com/tv", "hoyeeh.com/tv" in txt)
        check("no other transports/tabs", not any(w in txt for w in ["Quick Cast", "DLNA", "Smart TV", "Recent", "Chromecast", "AirPlay"]) and await dlg.get_by_role("tab").count() == 0)
        focused = await ph.evaluate("document.activeElement && document.activeElement.id")
        check("code input focused on open", focused == "tv-code", str(focused))
        box = await dlg.get_by_role("button", name="Scan TV QR code").bounding_box()
        check("touch target >= 44px", box and box["height"] >= 44, str(box and box["height"]))
        await ph.screenshot(path=str(SHOTS / "1_sheet.png"))
        await dlg.get_by_label("TV code").fill("ZZZZZ9"); await dlg.get_by_role("button", name="Connect").click()
        await dlg.get_by_role("alert").wait_for(timeout=15000)
        check("wrong code shows inline error", True)
        await dlg.get_by_label("TV code").fill(code.lower())
        await dlg.get_by_role("button", name="Connect").click()
        await dlg.get_by_test_id("cast-connected").wait_for(timeout=20000)
        check("connected state shown", True, (await dlg.get_by_test_id("cast-connected").text_content())[:60])
        await tv.wait_for_function("document.body.innerText.includes('Connected')", timeout=20000)
        check("TV window shows Connected", True)
        await ph.screenshot(path=str(SHOTS / "2_connected.png"))
        await dlg.get_by_role("button", name="Disconnect").click()
        await dlg.get_by_label("TV code").wait_for(timeout=10000)
        check("Disconnect returns to code entry", True)
        await ph.keyboard.press("Escape"); await ph.wait_for_timeout(500)
        check("Escape closes popup", await ph.get_by_role("dialog", name="Cast to TV").count() == 0)

        # --- 2. Title page popup, media mode: success only after LOAD ACK ---
        code = await tv_code(tv)
        await ph.goto(f"{BASE}/content/{CONTENT}"); await ph.wait_for_timeout(5000)
        await ph.screenshot(path=str(SHOTS / "2b_title.png")); print("url", ph.url)
        await ph.locator("button", has=ph.get_by_text("Cast", exact=True)).first.click()
        dlg = ph.get_by_role("dialog", name="Cast to TV"); await dlg.wait_for(timeout=10000)
        await dlg.get_by_label("TV code").fill(code)
        await dlg.get_by_role("button", name="Connect & play").click()
        waiting = await dlg.get_by_text("Waiting for TV…").count() + await dlg.get_by_text("Connecting…").count()
        check("shows waiting state while TV confirms", waiting > 0)
        outcome = None
        for _ in range(60):
            if await ph.get_by_role("dialog", name="Cast to TV").count() == 0: outcome = "closed"; break
            if await dlg.get_by_role("alert").count(): outcome = "alert:" + (await dlg.get_by_role("alert").text_content()); break
            await ph.wait_for_timeout(500)
        tv_src = await tv.evaluate("(document.getElementById('videoPlayer')||{}).currentSrc || ''")
        await ph.screenshot(path=str(SHOTS / "3_media_result.png")); await tv.screenshot(path=str(SHOTS / "3_tv.png"))
        if outcome == "closed":
            check("popup closed only after ACK and TV got the title", "digitaloceanspaces" in tv_src, tv_src[:80])
        else:
            check("LOAD failure kept popup open with reason + retry", outcome is not None and await dlg.get_by_role("button", name="Retry on TV").count() == 1, str(outcome))
        await b.close()
    print(f"{sum(results)}/{len(results)} passed")

asyncio.run(main())
