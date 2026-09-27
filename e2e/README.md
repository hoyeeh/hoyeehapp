# End-to-end checks

| Script | What it proves | How to run |
|---|---|---|
| `offline_owner_e2e.py` | Real Chromium + IndexedDB: interrupted download resumes via Range, verified complete, backend unreachable + expired token still plays, seek, reload resumes position, profile switch stops playback and hides the file, delete removes it. Uses `fixtures/fixture.webm` (6 s VP8 test pattern, generated with ffmpeg `testsrc`). | Dev server on :8080, then `python3 e2e/offline_owner_e2e.py` |
| `live_download_api.sh` | Live deployed services: Range 206 with real MP4 bytes, premium denial on both download services, client URL refused, no-auth refused, no media URL in manifest, licenses not client-editable, narrow completion RPC. | `lovable auth-session --json --self`, then `FREE_ID=… PREMIUM_ID=… bash e2e/live_download_api.sh` |
| `offline_live_e2e.py` | Live published site (default https://hoyeeh.com): service worker controls the page, true airplane mode (browser offline) cold start with expired sign-in lists the download, plays, seeks, reload resumes, profile switch hides it, missing chunk fails closed, delete removes it. Seeds the app's own offline store with the fixture (production has no source modules to drive the download engine); uses a fake local user only. | `python3 e2e/offline_live_e2e.py` (`E2E_BASE=https://www.hoyeeh.com` to override) |

Unit/behavior tests: `npx vitest run` (includes owner isolation, mid-download logout, expired/corrupt manifest, resume validation, host allowlist).

Not covered here: physical Chromecast/AirPlay/smart-TV/iOS/Android hardware; H.264 playback in headless Chromium (fixture is WebM for that reason).

## cast_two_window_e2e.py (browser only — not a physical TV)
Two browser windows: the TV receiver page (desktop size) and a phone-size controller
signed in via `lovable auth-session --json`. Pairs with the TV code, sends the
`e2e/fixtures/fixture.webm` fixture (served on http://localhost:8099) and checks the
phone reports success only after the TV confirms that exact LOAD, then Pause/Play/Seek,
refusals (no sign-in 401, blob/non-https LOAD, wrong code, commands after disconnect).
Run against the dev server: `python3 e2e/cast_two_window_e2e.py`.

- `e2e/cast_mobile_sheet_e2e.py` — phone "Cast to TV" popup vs TV receiver window (10 checks, device-management mode).
