
# New Releases Section: Full-Size Featured Card Implementation

## Overview
This plan implements two enhancements for the "New Releases" section:
1. **Full-size first card**: The first movie/content in the New Releases row will display with a full-cover image that fills the entire card area (using `object-cover` with a larger aspect ratio)
2. **Section-specific banner image**: Add the option to configure a custom banner/cover image specifically for the New Releases section, stored persistently in the database

---

## Implementation Steps

### 1. Database Schema Update
Add new columns to the `home_sections` table to support featured content and custom banner images:

```sql
-- Add columns for featured content and section banner
ALTER TABLE public.home_sections 
ADD COLUMN featured_content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
ADD COLUMN section_banner_url TEXT,
ADD COLUMN first_card_style TEXT DEFAULT 'backdrop';
```

- `featured_content_id`: Optional - allows pinning a specific content item as the first/featured card
- `section_banner_url`: Optional custom banner image URL for the section
- `first_card_style`: Controls how the first card displays (`backdrop`, `full`, or `poster`)

### 2. New Card Style: "Full Cover"
Add a new `full` card style to `ContentCardWithPreview.tsx`:

```text
Full Cover Card Specifications:
- Aspect ratio: 3:4 (taller than backdrop, wider than poster)
- Image: object-cover to fill entire card area
- Width: ~350px on desktop, ~280px on mobile  
- Height: Matches poster card heights for row alignment
```

**Changes to ContentCardWithPreview.tsx:**
- Add `full` to the `cardStyle` prop type
- Define dimensions in `cardWidths` and `aspectRatioClasses` objects
- Ensure image uses `object-cover` to fill the entire area

### 3. Update NewReleasesRow Component
Modify `NewReleasesRow.tsx` to:

1. Accept new props from section config:
   - `featuredContentId` - Pin specific content as first item
   - `sectionBannerUrl` - Optional section banner
   - `firstCardStyle` - Style for first card (`full`, `backdrop`, or `poster`)

2. Render first card with full-cover style:
   - If `firstCardStyle === 'full'`, render with new full-cover dimensions
   - The image fills the entire card without letterboxing

3. Add optional section banner above the row:
   - If `sectionBannerUrl` is provided, display as a clickable banner
   - Links to the first content item or a custom route

### 4. Update Admin Management Interface
Extend `EnhancedHomeSectionManagement.tsx` to add configuration options for `new_releases` sections:

**New form fields (conditional on section_type === "new_releases"):**
- "First Card Style" dropdown: Poster, Backdrop, Full Cover
- "Section Banner URL" input: Optional banner image URL
- "Featured Content" selector: Optional content picker to pin as first item

### 5. Update Index.tsx Homepage Integration
Modify the NewReleasesRow rendering in `Index.tsx` to pass new props:
- Read `first_card_style`, `section_banner_url`, `featured_content_id` from section config
- Pass to NewReleasesRow component

---

## Technical Details

### Card Style Dimensions

```text
Current Styles:
- poster: aspect-[2/3], w-40 md:w-52
- backdrop: aspect-video, calculated width to match poster height

New "full" Style:
- aspect-[3/4] for balanced proportions
- Width: w-[18rem] md:w-[22rem] 
- Height: Uses aspect ratio for natural sizing
- Image: object-cover ensures full coverage
```

### Featured Content Logic
When `featured_content_id` is set:
1. Fetch that specific content first
2. Filter it from the auto-fetched list to avoid duplicates
3. Prepend to the content array
4. This ensures the featured item always appears first

### Section Banner Display

```text
Position: Above the row title, full width with padding
Aspect: 21:9 (cinematic widescreen)
Styling: Rounded corners, gradient overlay, optional title overlay
Click: Navigates to first content item's details
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | New migration for schema changes |
| `src/components/ContentCardWithPreview.tsx` | Add `full` card style with dimensions |
| `src/components/NewReleasesRow.tsx` | Accept new props, render banner, use `firstCardStyle` |
| `src/components/admin/EnhancedHomeSectionManagement.tsx` | Add UI for new section options |
| `src/pages/Index.tsx` | Pass new section props to NewReleasesRow |

---

## Summary
This implementation adds persistent configuration for the New Releases section, allowing admins to:
- Set the first card to display as a full-cover image (filling the entire card)
- Optionally add a section banner image
- Optionally pin a specific content item as the featured first card

All settings are stored in the database and persist across sessions.
