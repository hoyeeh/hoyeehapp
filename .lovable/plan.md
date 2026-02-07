
# Remove Hardcoded Sections - Sync Desktop and Mobile with Admin Settings

## Problem Summary
Both the Desktop and Mobile apps have numerous hardcoded sections that render regardless of admin configuration. This creates inconsistency between what admins configure in the Home Section management and what users actually see.

## Current Hardcoded Sections

### Desktop (Index.tsx)
| Section | Component | Line |
|---------|-----------|------|
| Continue Watching | `ContinueWatchingRow` | 740-743 |
| Recently Watched | `RecentlyWatchedRow` | 746-749 |
| New Releases | `NewReleasesRow` | 752-776 |
| Recommended For You | `RecommendationsRow` | 779-784 |
| Because You Watched | `BecauseYouWatchedRow` | 787-792 |
| Hoyeeh Playables | `PlayablesSection` | 795 |
| Coming Soon | `ComingSoonRow` | 798 |
| AI Hoyeeh Picks | `AIRecommendationsRow` | 814-819 |

### Mobile (MobileHome.tsx)
| Section | Component | Line |
|---------|-----------|------|
| Continue Watching | `MobileOfflineContinueWatching` | 604-607 |
| My Purchases | `MobilePurchasesShortcut` | 612 |
| Recently Watched | `MobileRecentlyWatched` | 617-620 |
| AI Recommendations | `MobileAIRecommendations` | 624-625 |
| Because You Watched | `MobileBecauseYouWatchedRow` | 629-630 |
| Coming Soon | `MobileComingSoonRow` | 634-635 |
| Hoyeeh Playables | `MobilePlayablesRow` | 639-640 |

## Proposed Solution

### Step 1: Add Missing Section Types to Admin
Add new section types to the admin management so all current hardcoded sections can be controlled:

```text
New section types to add:
- recently_watched: Recently Watched (completed content)
- because_you_watched: Because You Watched (personalized)
- ai_recommendations: AI Hoyeeh Picks
- coming_soon: Coming Soon
- purchases: My Purchases (mobile only)
```

### Step 2: Add Database Migration for New Section Types
Insert default sections for the new types (or update existing section type validation):

```sql
-- Ensure all section types are supported
-- No schema change needed, just insert defaults if desired
```

### Step 3: Refactor Desktop Index.tsx
Remove all hardcoded sections and render everything based on `processedHomeSections` order:

```text
Before:
- Hardcoded: ContinueWatching, RecentlyWatched, NewReleases, Recommendations, etc.
- Dynamic: processedHomeSections loop

After:
- Single unified loop through processedHomeSections
- Each section_type maps to its appropriate component
- Section order matches admin's display_order
```

**Desktop Section Type Mapping:**
```typescript
switch (section.section_type) {
  case "continue_watching":
    return <ContinueWatchingRow {...props} />;
  case "recently_watched":
    return <RecentlyWatchedRow {...props} />;
  case "new_releases":
    return <NewReleasesRow {...props} />;
  case "ai_recommendations":
    return <AIRecommendationsRow {...props} />;
  case "because_you_watched":
    return <BecauseYouWatchedRow {...props} />;
  case "coming_soon":
    return <ComingSoonRow {...props} />;
  case "playables":
    return <PlayablesSection {...props} />;
  case "top10":
    return <Top10Row {...props} />;
  // ... other existing types
}
```

### Step 4: Refactor Mobile MobileHome.tsx
Apply the same unified approach:

```text
Before:
- Hardcoded: MobileOfflineContinueWatching, MobileRecentlyWatched, etc.
- Dynamic: processedHomeSections loop

After:
- Single unified loop through processedHomeSections
- Each section_type maps to its appropriate mobile component
- Section order matches admin's display_order
```

**Mobile Section Type Mapping:**
```typescript
switch (section.section_type) {
  case "continue_watching":
    return <MobileOfflineContinueWatching {...props} />;
  case "recently_watched":
    return <MobileRecentlyWatched {...props} />;
  case "ai_recommendations":
    return <MobileAIRecommendations {...props} />;
  case "because_you_watched":
    return <MobileBecauseYouWatchedRow {...props} />;
  case "coming_soon":
    return <MobileComingSoonRow {...props} />;
  case "playables":
    return <MobilePlayablesRow {...props} />;
  case "purchases":
    return <MobilePurchasesShortcut {...props} />;
  // ... other existing types
}
```

### Step 5: Update Admin UI Section Types
Add the new section types to `EnhancedHomeSectionManagement.tsx`:

```typescript
const SECTION_TYPES = [
  // Existing types
  { value: "top10", label: "Top 10" },
  { value: "new_releases", label: "New Releases (Last 2 weeks)" },
  // ...
  
  // New types
  { value: "recently_watched", label: "Recently Watched" },
  { value: "because_you_watched", label: "Because You Watched" },
  { value: "ai_recommendations", label: "AI Hoyeeh Picks" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "purchases", label: "My Purchases (Mobile)" },
];
```

### Step 6: Insert Default Sections for New Types
Create migration to insert default sections for the new types:

```sql
-- Add default sections for newly supported types
INSERT INTO home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile)
VALUES 
  ('Recently Watched', 'recently_watched', 'poster', 2, true, true, true),
  ('Because You Watched', 'because_you_watched', 'poster', 7, true, true, true),
  ('AI Hoyeeh Picks', 'ai_recommendations', 'poster', 8, true, true, true),
  ('Coming Soon', 'coming_soon', 'poster', 9, true, true, true),
  ('My Purchases', 'purchases', 'poster', 10, false, false, true)
ON CONFLICT DO NOTHING;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Remove hardcoded sections, unify rendering in single loop |
| `src/components/mobile/MobileHome.tsx` | Remove hardcoded sections, unify rendering in single loop |
| `src/components/admin/EnhancedHomeSectionManagement.tsx` | Add new section types to SECTION_TYPES array |
| `supabase/migrations/` | Add migration for default sections (optional) |

---

## Technical Details

### Unified Section Renderer Pattern
Both platforms will use a helper function to map section types to components:

```typescript
const renderSection = (section, index) => {
  const commonProps = {
    key: section.id,
    cardStyle: section.card_style,
    cardSize: section.card_size,
    sectionBannerUrl: section.section_banner_url,
  };

  switch (section.section_type) {
    case "continue_watching":
      return <ContinueWatchingComponent {...commonProps} />;
    case "recently_watched":
      return <RecentlyWatchedComponent {...commonProps} />;
    // ... all other types
    default:
      return <ContentRowComponent title={section.title} content={sectionContent} {...commonProps} />;
  }
};
```

### Section Visibility Logic
- Sections will only render if:
  1. `is_active = true`
  2. `show_on_desktop = true` (for desktop) or `show_on_mobile = true` (for mobile)
  3. The section has content to display (for content-based sections)

### Personalized Sections Behavior
- `continue_watching`: Only shows when user has in-progress content
- `recently_watched`: Only shows when user has completed content
- `because_you_watched`: Only shows when user has watch history
- `ai_recommendations`: Only shows when AI has generated picks
- `purchases`: Only shows when user has purchased content

### Fallback Behavior
If no home_sections are configured, show minimal fallback (already implemented in mobile).

---

## Summary
This refactor ensures:
1. All sections are controlled via admin configuration
2. Desktop and Mobile render sections in the same order (based on `display_order`)
3. Section titles, styles, and visibility are consistent across platforms
4. Admins can enable/disable any section without code changes
5. New section types can be added without modifying the core rendering logic
