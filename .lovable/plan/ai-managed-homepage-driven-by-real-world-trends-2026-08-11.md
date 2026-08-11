# AI-managed homepage driven by real-world trends

Yes, this is possible. One correction on the data source: IMDb has no public API you can license cheaply, and its data is scraped/licensed only. The project already has a **TMDB** key configured and TMDB functions in use (`tmdb-search`, `tmdb-details`, `tmdb-coming-soon-search`). TMDB carries IMDb IDs and IMDb-style ratings, so we get the same signal legally and for free. The plan uses TMDB as the trends source.

## What exists today

- `home_sections` drives every homepage row (desktop, mobile PWA, kids), with `max_items`, card style, and surface flags.
- `ai-homepage-audit` edge function already snapshots sections + internal watch history and asks Gemini for improvements, writing to `homepage_ai_suggestions`.
- `apply-homepage-suggestion` applies an approved suggestion to `home_sections`.
- Admin UI: "AI Homepage Suggestions" panel in the Home Page tab.

So the framework is built. What is missing is the **external trend signal** and the **automatic management loop**.

## What we add

### 1. Trend ingestion from TMDB
New edge function `tmdb-trends-sync`:
- Pulls TMDB trending (day + week), popular, and top-rated for movies and TV.
- Stores results in a new `external_trends` table (tmdb_id, imdb_id, title, media_type, genres, popularity, vote_average, trend_rank, window, fetched_at).
- Matches each trend row against our catalog by TMDB id first, then normalized title + year, and stores the matched `content_id` when we own the title.
- Runs on a schedule (twice daily) via the existing pg_cron scheduler.

### 2. Trend-aware AI audit
Extend `ai-homepage-audit`:
- Feed the AI three signals instead of one: current section config, internal watch history, and the new TMDB trend table (split into "trending titles we own" and "trending genres globally").
- New suggestion type `content_swap` becomes real: for auto/curated rows, propose the ordered list of owned content IDs that are trending right now.
- New suggestion type `new_section`: e.g. "Trending Now Worldwide", "Because Horror Is Spiking", built only from titles we actually own so no row can render empty.
- Every suggestion keeps the admin-set `max_items`, card style, and surface flags — the AI never overrides admin layout rules.

### 3. Autopilot mode (admin controlled)
- New settings row: `ai_homepage_autopilot` with `enabled`, `confidence_threshold`, `allowed_types` (which suggestion types may self-apply).
- When autopilot is on, the audit function applies suggestions at or above the threshold automatically through the same `apply-homepage-suggestion` logic, and logs every applied change so admins can review and roll back.
- When off, behaviour is unchanged: suggestions queue for manual approval.

### 4. Admin UI
In the Home Page tab, next to the existing suggestions panel:
- Autopilot toggle + threshold slider + per-type checkboxes.
- "Trends" view listing current TMDB trending titles, flagged owned vs not owned (the not-owned list doubles as an acquisition wishlist).
- Change log of auto-applied actions with a one-click revert.

## Guardrails

- AI can only reference content IDs that exist and are active; empty rows are impossible.
- Kids surfaces stay filtered by the existing kids restrictions — trend data never bypasses them.
- Premium/paid flags and DRM rules are untouched; this is layout and ordering only.
- Autopilot is off by default and every automatic change is logged and revertible.

## Technical notes

- New table `external_trends` plus `ai_homepage_settings`, both with RLS: admin/super_admin read-write, service_role full, no anon access.
- Suggestion application reuses `apply-homepage-suggestion` so there is one code path for manual and automatic changes.
- TMDB calls use the existing `TMDB_API_KEY` secret, server-side only.
- Title matching normalizes case, punctuation, and articles, and requires a release-year match within one year to avoid false positives.
