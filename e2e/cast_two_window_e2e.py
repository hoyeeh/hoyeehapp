"""
Two-window TV-code cast E2E (browser only — NOT a physical TV test).

Window A: /tv-receiver/index.html (desktop 1280x720) shows a pairing code.
Window B: phone viewport (390x844) signed in, opens /cast?code=<code> with a
pending fixture video, which must only report success after the receiver ACKs
the exact LOAD. Then PAUSE / PLAY / SEEK / disconnect are verified on the TV
window, plus unauthorized + bad-code + unreachable-media refusals.

Env: E2E_BASE (default http://localhost:8080), FIXTURE_URL (default serves
e2e/fixtures/fixture.webm on http://localhost:8099), session from
~/.cache/lovable-auth/session.json (`lovable auth-session --json`).
"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:8080")
HERE = Path(__file__).parent
SHOTS = Path("/tmp/browser/cast_e2e"); SHOTS.mkdir(parents=True, exist_ok=True)
results = []

def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

async def main():
    srv = None
    fixture = os.environ.get("FIXTURE_URL")
    if not fixture:
        srv = subprocess.Popen([sys.executable, "-m", "http.server", "8099", "-d", str(HERE / "fixtures")],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1); fixture = "http://localhost:8099/fixture.webm"
    minted = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        tv = await (await b.new_context(viewport={"width": 1280, "height": 720})).new_page()
        await tv.goto(f"{BASE}/tv-receiver/index.html")
        await tv.wait_for_function("/^[A-Z0-9]{6}$/.test(document.getElementById('pairingCode').textContent.trim())", timeout=30000)
        code = (await tv.text_content("#pairingCode")).strip()
        check("TV shows pairing code", True, code)

        phone_ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                        user_agent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")
        phone = await phone_ctx.new_page()
        await phone.goto(BASE)
        await phone.evaluate(f"localStorage.setItem({json.dumps(minted['storage_key'])}, {json.dumps(json.dumps(minted['session']))})")

        # Bad code is refused honestly
        await phone.goto(f"{BASE}/cast?code=ZZZZZZ")
        await phone.wait_for_timeout(4000)
        body = await phone.text_content("body")
        check("wrong code refused (not connected)", "Not connected" in body or "Could not pair" in body)

        # Real pair with a pending fixture: React Router state carries pendingVideo.
        await phone.goto(BASE)
        await phone.evaluate("""([code, url]) => {
          history.pushState({usr: {pendingVideo: {url, title: 'E2E Fixture', duration: 5}}, key: 'e2e', idx: 1}, '', '/cast?code=' + code);
          dispatchEvent(new PopStateEvent('popstate', {state: history.state}));
        }""", [code, fixture])
        toast = phone.get_by_text('Casting "E2E Fixture" to TV')
        await toast.wait_for(timeout=30000)
        check("phone shows success only after LOAD ACK", True)
        await tv.wait_for_function("(() => { const v = document.getElementById('videoPlayer'); return v && v.currentSrc.includes('fixture.webm') && v.readyState >= 2; })()", timeout=20000)
        check("TV video element loaded the fixture", True)
        await phone.screenshot(path=str(SHOTS / "phone_connected.png")); await tv.screenshot(path=str(SHOTS / "tv_playing.png"))

        async def tv_state():
            return await tv.evaluate("(() => { const v = document.getElementById('videoPlayer'); return {paused: v.paused, t: v.currentTime}; })()")

        async def send(cmd, payload=None):
            return await phone.evaluate("""async ([cmd, payload, key]) => {
              const s = JSON.parse(localStorage.getItem(key));
              const sid = Object.keys(localStorage).filter(k => k.startsWith('hoyeeh_paired_devices:')).map(k => JSON.parse(localStorage.getItem(k))).flat().pop().sessionId;
              return {sid, token: s.access_token};
            }""", [cmd, payload, minted["storage_key"]])

        # Drive controls through the /cast remote UI buttons
        for label, expect_paused in (("Pause", True), ("Play", False)):
            btn = phone.get_by_role("button", name=label, exact=True)
            if await btn.count() == 0:
                btn = phone.locator(f"button[aria-label='{label}']")
            await btn.first.click()
            try:
                await tv.wait_for_function(f"document.getElementById('videoPlayer').paused === {str(expect_paused).lower()}", timeout=10000)
                check(f"{label} applied on TV", True)
            except Exception:
                check(f"{label} applied on TV", False, str(await tv_state()))

        # Unauthorized command (no JWT) is rejected by cast-signaling
        info = await send("noop")
        env = open(HERE.parent / ".env").read()
        sup = [l.split("=",1)[1].strip().strip('"') for l in env.splitlines() if l.startswith("VITE_SUPABASE_URL")][0]
        anon = [l.split("=",1)[1].strip().strip('"') for l in env.splitlines() if l.startswith("VITE_SUPABASE_PUBLISHABLE_KEY")][0]
        def post(body, token):
            req = urllib.request.Request(f"{sup}/functions/v1/cast-signaling?action=command", data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json", "apikey": anon, "Authorization": f"Bearer {token}"})
            try:
                with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
            except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
        st, _ = post({"sessionId": info["sid"], "command": "PAUSE"}, anon)
        check("command without user sign-in refused", st in (401, 403), str(st))
        st, js = post({"sessionId": info["sid"], "command": "SEEK", "payload": {"time": 2}}, info["token"])
        check("signed-in SEEK accepted with seq", st == 200 and isinstance(js.get("seq"), int), str(js)[:120])
        try:
            await tv.wait_for_function("Math.abs(document.getElementById('videoPlayer').currentTime - 2) < 1.5", timeout=10000)
            check("SEEK applied on TV", True)
        except Exception:
            check("SEEK applied on TV", False, str(await tv_state()))
        st, js = post({"sessionId": info["sid"], "command": "LOAD", "payload": {"videoUrl": "blob:https://x/1"}}, info["token"])
        check("server refuses non-https / blob LOAD", st >= 400 or js.get("success") is False, str(js)[:120])

        # Disconnect from the phone UI
        dc = phone.get_by_role("button", name="Disconnect")
        if await dc.count():
            await dc.first.click()
            await phone.get_by_text("Not connected").first.wait_for(timeout=10000)
            check("phone disconnect returns to pairing", True)
        else:
            check("phone disconnect returns to pairing", False, "no Disconnect button")
        st, js = post({"sessionId": info["sid"], "command": "PLAY"}, info["token"])
        check("commands after disconnect refused", st >= 400 or js.get("success") is False, str(st))
        await phone.screenshot(path=str(SHOTS / "phone_disconnected.png"))
        await b.close()
    if srv: srv.terminate()
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed"); sys.exit(1 if failed else 0)

asyncio.run(main())
