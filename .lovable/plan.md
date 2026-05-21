# Video Player & Casting E2E Audit + /tv Fix

## Goal
Audit the video player end-to-end across desktop and mobile, close real gaps, gate casting to only verified-working protocols, and fix `hoyeeh.com/tv`. Deliver a written report. Zero regressions to existing playback.

## Scope (in)
- Desktop player: `src/player/ui/desktop/DesktopPlayer.tsx` + `PlayerEngine`, HLS/MP4 sources, DRM/signed URL flow, subtitles, PiP, resume.
- Mobile player: `src/player/ui/mobile/MobilePlayer.tsx`, gesture controls, mini-player, mobile YouTube player context.
- Casting stack: `CastContext`, `useGoogleCast`, `useAirPlay`, `useDLNA`, `useNativeCast`, `useUniversalCast`, `useScreenMirror`, TV pairing/QR fallback.
- `/tv` route — `TV.tsx`, `TVApp.tsx`, `TVReceiver.tsx`, public `/tv/index.html` redirect.

## Scope (out)
- New player features, codec changes, redesign.
- Editing DRM keys, Widevine config, Mux processing pipeline.
- Server-side signed-URL TTL or IP-binding logic.

## Audit checklist (per surface)
1. Mount/unmount: no leaked listeners, channels, MediaSession, timers.
2. Source loading: HLS + MP4 happy path, error path, retry, signed-URL refresh.
3. Controls: play/pause, seek, volume, fullscreen, PiP, captions, quality, speed.
4. Resume: 60s trigger, IndexedDB persistence, 95% completion clear.
5. Subtitles: load, switch, off, style settings.
6. Mobile gestures: brightness/volume swipes don't fight scroll, double-tap seek.
7. Mini-player: handoff, dismissal, route changes.
8. Casting per protocol: discovery, connect, load media, play/pause/seek, disconnect, error surfacing.
9. Analytics events fire once per state transition (no duplicates).
10. Accessibility: focus trap in fullscreen, ARIA on controls, keyboard shortcuts.

## Casting capability gating
Build a single `CAST_CAPABILITIES` matrix (web / iOS PWA / Android PWA / native iOS / native Android) listing which protocols are **verified working**:
- Chromecast (web SDK) — only when `window.cast` available AND `useGoogleCast` reports `apiAvailable=true`.
- AirPlay — only on Safari/iOS with `WebKitPlaybackTargetAvailabilityEvent`.
- Native Google Cast (Capacitor) — only when running native and plugin is registered.
- DLNA — only when relay/discovery returns ≥1 device within 3s.
- TV pairing code / QR — always available as fallback.

Hide UI entries for protocols that fail capability check. Today the UI shows Chromecast even though the SDK timed out (`[GoogleCast] SDK load timeout` in current logs) — that button will now hide automatically.

## /tv fix
Investigate why `hoyeeh.com/tv` 404s:
- Confirm `/tv` route is registered in `App.tsx` (it is — `TV` component) but `public/tv/index.html` may be intercepting on the published host. Either remove the static stub or make it redirect into the SPA route via `<meta http-equiv="refresh">` + history fallback in `public/_headers` / hosting config.
- Verify SPA fallback rewrite for `/tv` and `/tv/*` so deep links hit `index.html`.

## Implementation steps
1. Read player + casting + TV files; map current behavior into the checklist.
2. Create `src/player/castCapabilities.ts` with detection + gating helper. Wire it into `CastContext` so unsupported entries are filtered out everywhere (desktop player menu, mobile cast sheet, mini-player cast button).
3. Fix any concrete gaps found during audit using **minimal, surgical patches** (no rewrites). Each fix gets a comment referencing the audit item.
4. Fix `/tv`:
   - Update `public/tv/index.html` to redirect to `/tv-app` (or whatever the SPA route should be) instead of serving a competing shell, OR delete it if redundant.
   - Add SPA fallback rule so `/tv` resolves to `index.html` on the published host.
5. Add focused vitest specs:
   - `castCapabilities.test.ts` — matrix returns expected protocols per env.
   - `tvRoute.test.ts` — `/tv` resolves to `TV` page component.
6. Run vitest suite; do not break existing tests.
7. Write report at `docs/audits/player-cast-2026-05-21.md` with: surfaces audited, gaps found, fixes applied, capabilities matrix, and known limitations (e.g. "DLNA disabled in web PWA because relay not deployed").

## Technical notes
- Capability detection must be SSR/preview-safe — guard every `window`, `navigator`, `cast`, `WebKit*` access.
- Do not remove existing cast code paths; only hide their UI entry points when unsupported. Keeps door open for re-enabling once tested.
- `/tv` fix should also work for `/tv-receiver` and `/tv-app` deep links.
- Report is markdown, committed to repo so it's auditable.

## Deliverables
- Capability gating module + UI integration.
- Concrete bug fixes from audit (list in report).
- Working `/tv` route on production host.
- 2 new vitest files, all green.
- `docs/audits/player-cast-2026-05-21.md` full report.

## Out-of-scope follow-ups (will list in report, not implement)
- Adding new cast protocols.
- Migrating off Mux or DRM.
- E2E browser tests (Playwright) — not currently in stack.

Approve to proceed.
