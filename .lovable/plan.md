# AI Homepage Manager — Netflix-Style

Goal: AI continuously audits admin homepage configuration, proposes fixes and new sections for admin approval, and personalizes section ordering + content per visitor.

## What gets built

### 1. Admin: AI Suggestions Queue
New admin tab **Homepage → AI Suggestions** showing pending AI proposals with Approve / Reject / Edit:
- **Heal**: empty section, too few items, stale content, broken `max_items`, duplicate sections, broken thumbnails
- **New section**: e.g. "Trending in Action", "K-Drama Picks", "Because viewers loved X"
- **Reorder**: global section order tuned to engagement
Each suggestion stores: type, target_section_id (nullable), proposed_payload (jsonb), reason, status, created_at. Approve writes the change to `home_sections` / `section_content`.

### 2. Daily AI Audit (cron)
New edge function `ai-homepage-audit` runs daily via pg_cron:
- Pulls `home_sections`, counts actual content per section vs `max_items`, flags gaps
- Pulls last 30d view/CTR data from `watch_history` and `homepage_ads_events`
- Calls Lovable AI (`google/gemini-3-flash-preview`) with the snapshot + catalog summary
- Writes proposals to `homepage_ai_suggestions` (status=pending)
- Sends admin notification: "X new homepage suggestions"

### 3. Per-visitor Netflix-style rows
Four new dynamic row types rendered on Home (desktop + mobile), respecting admin `max_items`:
- **Because You Watched [Title]** — uses last completed item from `watch_history`, finds similar by genre/keywords
- **Top 10 in [Country]** — geo from `profiles.country`, ranks by 7d view count
- **New Releases For You** — `recently_added` filtered by user's top 3 genres
- **Continue Watching + Up Next** — extends existing resume row with AI-picked "next" suggestion

Ordering: a lightweight client scorer (existing watch history + section type) reorders admin-enabled sections per visitor without changing admin config. Pinned/featured sections from admin stay locked at top.

### 4. Enforcement of admin `max_items`
Audit also verifies every section component slices to `max_items`. The earlier audit already patched the row components; this step adds an automated regression check that flags any section returning more than configured.

## Technical details

**New table** `homepage_ai_suggestions`
- columns: `suggestion_type` (heal|new_section|reorder|content_swap), `target_section_id uuid null`, `proposed_payload jsonb`, `reason text`, `priority int`, `status` (pending|approved|rejected|applied), `reviewed_by`, `reviewed_at`
- RLS: admins/super_admins read+write; full GRANTs to authenticated + service_role
- Service-role insert from edge function

**New edge functions**
- `ai-homepage-audit` (cron, service-role): snapshot → Gemini → insert suggestions
- `apply-homepage-suggestion` (admin JWT): applies an approved suggestion atomically to `home_sections`/`section_content`
- `personalize-home-sections` (user JWT): returns per-visitor ordered section IDs + dynamic "Because you watched" target, cached 1h in localStorage

**Existing functions reused**: `get-recommendations`, `ai-recommendations` (already personalized); homepage rendering already dynamic from `home_sections` (per Core memory rule).

**pg_cron**: daily 04:00 UTC trigger calling `ai-homepage-audit`.

**Frontend**
- `src/pages/admin/HomepageAISuggestions.tsx` — queue UI with diff preview
- `src/hooks/usePersonalizedHomeOrder.ts` — fetch + cache personalized order
- `src/components/BecauseYouWatchedRow.tsx`, `TopInCountryRow.tsx`, `NewReleasesForYouRow.tsx` (+ mobile variants)
- Wire new section_types into `Index.tsx` and `MobileHome.tsx` dynamic mapper

**Guardrails**
- Admin pinned sections never reordered
- Kids profiles: suggestions filtered to G/PG and Animation/Family (existing kids constraint memory)
- All AI output validated against existing `home_sections` schema before insertion
- Suggestions auto-expire after 14 days if not reviewed

## Out of scope
- Auto-apply without admin approval (explicitly chose "AI suggests, admin approves")
- Real-time per-request AI calls (using cached daily output + cheap client-side reorder)
- Changing existing section rendering contract
