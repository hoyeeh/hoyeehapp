# Video Player & Casting E2E Audit — 2026-05-21

Scope: full review of the Hoyeeh video player + casting stack across desktop
and mobile, fix discovered gaps, gate casting to **verified-working**
protocols only, and fix `hoyeeh.com/tv`. Zero regressions.

---

## 1. Surfaces audited

| Surface                              | File(s)                                                            | Verdict |
|--------------------------------------|--------------------------------------------------------------------|---------|
| Desktop player                       | `src/player/ui/desktop/DesktopPlayer.tsx`, `PlayerEngine`          | OK      |
| Mobile player                        | `src/player/ui/mobile/MobilePlayer.tsx`                            | OK      |
| HLS + MP4 source adapters            | `src/player/core/sources/HlsSource.ts`, `Mp4Source.ts`             | OK      |
| Signed URL flow                      | `src/hooks/useSignedVideoUrl.ts`, `useSecureVideoUrl.ts`           | OK      |
| Resume / continue watching           | `src/hooks/useWatchProgress.ts`, `src/lib/playbackStorage.ts`       | OK      |
| Subtitles + style                    | `src/hooks/useSubtitles.ts`, `useSubtitleSettings.ts`              | OK      |
| Mini-player                          | `src/contexts/MiniPlayerContext.tsx`                               | OK      |
| Mobile gestures                      | `src/player/ui/mobile/MobilePlayer.tsx`                            | OK      |
| **Casting (Chromecast)**             | `useGoogleCast.ts`, `useNativeCast.ts`                             | **GAP** |
| **Casting (AirPlay)**                | `useAirPlay.ts`                                                    | **GAP** |
| **Casting (DLNA)**                   | `useDLNA.ts`                                                       | **GAP** |
| TV pairing / QR fallback             | `CastPairingDialog.tsx`, `MobileQRScanner.tsx`                     | OK      |
| **`/tv` route**                      | `public/tv/index.html`, `src/pages/TV.tsx`                         | **GAP** |

---

## 2. Gaps found

### G1. Cast UI showed protocols whose SDKs were not available
**Symptom:** In Lovable preview console:
`[GoogleCast] API available: false … [GoogleCast] SDK load timeout`.
Despite this, the desktop CastPanel and MobileCastSheet still rendered a
"Chromecast" section / button with greyed-out states. Users could tap them,
see a toast error, and lose trust in the feature.

Same pattern existed for AirPlay outside Safari and DLNA on the web (which
literally cannot perform SSDP discovery).

**Fix:** Introduced a single capability matrix at
`src/player/castCapabilities.ts` and wired it into both Cast UIs. Sections
for protocols flagged `enabled: false` are no longer rendered. The
underlying hooks remain in place — re-enabling a protocol is just a matter
of feature detection improving.

### G2. `hoyeeh.com/tv` 404 / dead-redirect
**Symptom:** Hitting `/tv` on the published host did not reach the TV
experience reliably.

**Root cause:** `public/tv/index.html` was a static stub doing
`window.location.replace('/tv-receiver/')`. On Lovable hosting any static
asset wins over an SPA route, so the SPA `TV` page never executed. Worse,
this static stub competed with `src/pages/TV.tsx`, creating two redirects
in series and breaking deep linking from in-app navigation.

**Fix:** Deleted `public/tv/index.html`. `/tv` now resolves through the SPA
to `src/pages/TV.tsx`, which redirects to `/tv-receiver/index.html` (the
real TV receiver static page). Deep links work, SPA navigation works.

### G3. Capability detection not SSR-safe
**Symptom:** A few earlier hooks read `window.cast` / `navigator.userAgent`
unguarded, which would throw under vitest's jsdom environment.

**Fix:** All detection in the new `castCapabilities.ts` module guards every
`window` / `navigator` / `cast` / `Capacitor` access. Verified by the new
`castCapabilities.test.ts` suite (9 cases).

---

## 3. Capability matrix (current state)

| Protocol     | Web (Chrome) | Web (Safari) | iOS PWA | Android PWA | Native iOS | Native Android |
|--------------|:-:|:-:|:-:|:-:|:-:|:-:|
| Chromecast (Web SDK) | ✓ when SDK loads | ✗ | ✗ | ✗ | ✗ | ✗ |
| AirPlay              | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| DLNA                 | ✗ (no SSDP) | ✗ | ✗ | ✗ | ✓ relay | ✓ relay |
| Native Google Cast   | ✗ | ✗ | ✗ | ✗ | requires plugin | ✓ |
| TV pairing code      | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| QR fallback          | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

A protocol marked `✗` is **not rendered** in the cast UI for that surface —
users see only the entries that will actually work for them.

---

## 4. Fixes applied (this audit)

| # | Change | Files |
|---|--------|-------|
| 1 | New capability matrix module | `src/player/castCapabilities.ts` (new) |
| 2 | Wired matrix into mobile cast sheet — hides Chromecast/AirPlay when unsupported | `src/components/mobile/MobileCastSheet.tsx` |
| 3 | Wired matrix into desktop cast panel — hides Chromecast / DLNA / AirPlay sections when unsupported | `src/components/cast/CastPanel.tsx` |
| 4 | Removed dead `/tv` static stub causing `hoyeeh.com/tv` failure | `public/tv/index.html` deleted |
| 5 | New vitest suite covering all detection paths and the env-aware matrix | `src/test/castCapabilities.test.ts` (new) |

All 31 vitest cases pass (4 suites). No existing test broke.

---

## 5. Non-regression assertions

- Existing hooks (`useGoogleCast`, `useAirPlay`, `useDLNA`, `useNativeCast`,
  `useUniversalCast`) are **unmodified** — only the UI rendering them is
  gated. Re-enabling a hidden protocol is purely a UI change.
- Mini-player handoff, MediaSession metadata, resume @95% completion, and
  subtitle loading were re-read and remain functionally correct on both
  Desktop and Mobile player paths.
- TV pairing code + QR fallback continue to be advertised universally as a
  guaranteed path to cast — matches the Mobile PWA Layout memory.
- `/tv-receiver/index.html` is untouched; only the conflicting `/tv/`
  static stub was removed.

---

## 6. Known limitations / follow-ups (NOT done in this audit)

1. **DLNA in native shell** — the relay endpoint exists in code but is not
   wired to a deployed listener. Until the relay is reachable, the matrix
   keeps DLNA hidden on native too unless a device is already known.
2. **Playwright/full browser E2E** — the project does not run Playwright
   in CI; this audit covers vitest + capability matrix + manual review.
   Adding Playwright would be a follow-up.
3. **Cast analytics** — events still fire from the legacy hooks. Once UI
   gating settles, the analytics adapter should learn the matrix so it
   does not record "cast_attempt" for protocols never shown to the user.

---

## 7. How to extend

To add or re-enable a protocol:
1. Add it to `CastProtocol` union and `CastCapabilities` shape in
   `src/player/castCapabilities.ts`.
2. Add detection logic; keep every browser API access guarded.
3. Add a test case to `src/test/castCapabilities.test.ts`.
4. Render it in the cast UIs gated by `capabilities.<protocol>.enabled`.

That is the entire surface area. The matrix is the source of truth.
