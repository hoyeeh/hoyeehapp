// Shared "admin filters" applier for home_sections rows.
// Honors the universal filters that admins can set on ANY homepage section:
//   - year_filter   (exact year)
//   - year_min / year_max (range)
//   - genre_id (resolved via genre.name match against content.genre)
//   - content_type_filter ('movie' | 'series' | 'all')
//
// Sections like "by_year" already encode the year in their type, so they
// short-circuit. Curated section_content respects these filters too so that
// admins can keep a manual list AND still scope it (e.g. only this year).

export interface HomeSectionFilterSource {
  section_type?: string | null;
  content_type_filter?: string | null;
  year_filter?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  genre?: { name?: string | null } | null;
}

export interface FilterableContent {
  contentType?: "movie" | "series" | string;
  year?: number | null;
  genre?: string | null;
}

export function applyAdminFilters<T extends FilterableContent>(
  items: T[],
  section: HomeSectionFilterSource | null | undefined
): T[] {
  if (!section || !items?.length) return items;

  // by_year sections derive year from the title; leave them alone.
  if (section.section_type === "by_year") return items;

  let result = items;

  // Content type
  const ctf = section.content_type_filter;
  if (ctf === "movie" || ctf === "series") {
    result = result.filter((c) => c.contentType === ctf);
  }

  // Genre (name-based, case-insensitive substring — matches existing logic)
  const genreName = section.genre?.name?.trim();
  if (genreName && section.section_type !== "genre") {
    const needle = genreName.toLowerCase();
    result = result.filter((c) => (c.genre || "").toLowerCase().includes(needle));
  }

  // Year — exact wins over range
  if (typeof section.year_filter === "number" && section.year_filter > 0) {
    result = result.filter((c) => c.year === section.year_filter);
  } else {
    if (typeof section.year_min === "number" && section.year_min > 0) {
      const minimum = section.year_min;
      result = result.filter((c) => minimum !== null && minimum !== undefined && (c.year ?? -Infinity) >= minimum);
    }
    if (typeof section.year_max === "number" && section.year_max > 0) {
      const maximum = section.year_max;
      result = result.filter((c) => maximum !== null && maximum !== undefined && (c.year ?? Infinity) <= maximum);
    }
  }

  return result;
}
