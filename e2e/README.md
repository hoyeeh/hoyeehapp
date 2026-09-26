# End-to-end checks

| Script | What it proves | How to run |
|---|---|---|
| `offline_owner_e2e.py` | Real Chromium + IndexedDB: interrupted download resumes via Range, verified complete, backend unreachable + expired token still plays, seek, reload resumes position, profile switch stops playback and hides the file, delete removes it. Uses `fixtures/fixture.webm` (6 s VP8 test pattern, generated with ffmpeg `testsrc`). | Dev server on :8080, then `python3 e2e/offline_owner_e2e.py` |
| `live_download_api.sh` | Live deployed services: Range 206 with real MP4 bytes, premium denial on both download services, client URL refused, no-auth refused, no media URL in manifest, licenses not client-editable, narrow completion RPC. | `lovable auth-session --json --self`, then `FREE_ID=… PREMIUM_ID=… bash e2e/live_download_api.sh` |

Unit/behavior tests: `npx vitest run` (includes owner isolation, mid-download logout, expired/corrupt manifest, resume validation, host allowlist).

Not covered here: physical Chromecast/AirPlay/smart-TV/iOS/Android hardware; H.264 playback in headless Chromium (fixture is WebM for that reason).
