# Homepage parity and management audit

## Recommended direction

Keep the admin’s manual homepage as the permanent layout contract. AI may refresh eligible row content and flag broken rows, but it must not create or reorder rows automatically. This preserves the admin’s structure while still keeping titles current by release date and verified trend signals.

## Work

1. **Unify homepage rules**
   - Extract one shared content-selection and release-ordering pipeline for desktop web, main mobile PWA, and Kids mobile/desktop.
   - Sort automatic rows by exact release date when available, then release year, then catalogue-added date.
   - Preserve explicit admin ordering for curated and Top 10 rows.
   - Apply the same admin filters, item limits, duplicate rules, and surface flags everywhere.

2. **Prevent manual/AI overlap**
   - Make the manual layout the authoritative source for section structure and presentation settings.
   - Limit AI autopilot to content refreshes and safe healing; disable automatic row creation and reordering.
   - Ensure an AI content refresh targets the corresponding live row without activating a second layout or accumulating rows.
   - Keep manual review available for structural AI suggestions, with a single clearly marked best recommendation.

3. **Match presentation across surfaces**
   - Align section order, titles, card styles, and content membership across desktop web and main PWA when both surface flags are enabled.
   - Make Kids web and Kids PWA use the same Kids-safe dynamic section pipeline and ordering.
   - Retain Kids safety, time limits, parental approvals, and age filtering.
   - Refine the existing dark Apple-style presentation with restrained motion, consistent spacing, typography, and cards—without replacing admin content choices.

4. **Data cleanup and safeguards**
   - Restore the admin manual layout as the base.
   - Remove/deactivate accumulated AI-only structural rows from the live homepage while preserving history and rollback records.
   - Add safeguards so future audits cannot create overlapping live layouts or duplicate section names.

5. **Verification**
   - Add focused tests for release ordering, curated-order preservation, desktop/mobile parity, Kids parity, and manual/AI exclusivity.
   - Run authenticated Playwright checks on desktop and mobile viewports for main and Kids profiles where available.
   - Verify manual changes refresh across all surfaces and AI content updates do not alter the admin’s layout.
   - Run the complete test suite and confirm the preview build is clean.

## Technical notes

- The current live state is AI mode with 53 active AI rows cloned or accumulated from 36 manual rows; autopilot currently permits content swaps, healing, row creation, and reordering.
- The audit will change this to a content-management model: manual rows define structure; AI updates only allowed content assignments.
- No premium access, DRM, playback, download, casting, or Kids safety rules will change.
