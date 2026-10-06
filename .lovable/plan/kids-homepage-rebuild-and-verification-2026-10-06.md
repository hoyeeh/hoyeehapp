# Kids homepage rebuild and verification

## Outcome
Create a polished, calm Kids homepage on desktop and mobile that uses its own admin-managed layout, never repeats a title across rows, and only shows playable content allowed by the Kids catalogue policy.

## Build
- Add a separate Kids homepage surface to the existing homepage configuration so its row order, card style, card size, active state, and curated titles are independent from the main homepage.
- Add clear Main Home and Kids Home views in admin management, with Kids-only content choices restricted to eligible G-rated Family/Kids/Animation titles.
- Update desktop and mobile Kids pages to render only the Kids layout, follow admin ordering and card settings, refresh after admin changes, and suppress duplicate titles across the featured area and all rows.
- Replace the current decorative panels and celebration effects with a restrained, artwork-led presentation using the existing Hoyeeh theme and semantic styles.
- Use the real playable Kids movies already held in the catalogue to seed professional Kids rows instead of duplicating or inventing media records.
- Close the desktop Kids playback safety gap so time limits, bedtime, and Cast hiding apply from Kids homepage playback on web as well as mobile.

## Verification
- Add regression tests for layout isolation, admin ordering/card settings, duplicate suppression, Kids policy filtering, and player restrictions.
- Run the full test suite, type check, build, and relevant security checks.
- On the published app, create a real Kids profile, set limits, open a playable Kids movie from the home screen, and confirm time-limit, bedtime, and hidden Cast behavior. Report any hardware-only limitation separately.
