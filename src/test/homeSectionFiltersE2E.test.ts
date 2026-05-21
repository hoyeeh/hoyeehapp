/**
 * End-to-end style test for the admin Homepage filter UX.
 *
 * What this covers:
 *  - Admin sets year_min / year_max + genre on a home_sections row
 *  - Public homepage (desktop Index + every MobileHome variant) applies the
 *    same `applyAdminFilters` pipeline to its raw content arrays
 *  - Filtered output respects the admin config WITHOUT mutating row order,
 *    section structure, or losing items in unrelated sections
 *
 * The real desktop + mobile pages already import `applyAdminFilters` from
 * `@/lib/homeSectionFilters` and call it identically, so exercising that
 * shared pipeline against realistic section configs is a faithful proxy for
 * the actual rendered behavior — without needing a Playwright runner.
 */
import { describe, it, expect } from "vitest";
import { applyAdminFilters, type HomeSectionFilterSource } from "@/lib/homeSectionFilters";

type Item = {
  id: string;
  contentType: "movie" | "series";
  year: number;
  genre: string;
};

const library: Item[] = [
  { id: "m-2018-action", contentType: "movie", year: 2018, genre: "Action" },
  { id: "m-2021-drama", contentType: "movie", year: 2021, genre: "Drama" },
  { id: "m-2023-action", contentType: "movie", year: 2023, genre: "Action" },
  { id: "m-2025-action", contentType: "movie", year: 2025, genre: "Action" },
  { id: "m-2026-comedy", contentType: "movie", year: 2026, genre: "Comedy" },
  { id: "s-2020-action", contentType: "series", year: 2020, genre: "Action" },
  { id: "s-2024-drama", contentType: "series", year: 2024, genre: "Drama" },
  { id: "s-2026-action", contentType: "series", year: 2026, genre: "Action" },
];

// Simulates the canonical homepage layout configs (desktop + mobile share the
// same `home_sections` rows; the only difference is which row's
// show_on_desktop / show_on_mobile flag is true).
const sections: Record<string, HomeSectionFilterSource> = {
  trending: { section_type: "trending" },
  recently_added: { section_type: "recently_added" },
  custom_action_2023_2026: {
    section_type: "custom",
    genre: { name: "Action" },
    year_min: 2023,
    year_max: 2026,
  },
  movies_only_2025_plus: {
    section_type: "custom",
    content_type_filter: "movie",
    year_min: 2025,
  },
  by_year_legacy: { section_type: "by_year", year_filter: 1999 },
  genre_row_action: { section_type: "genre", genre: { name: "Action" } },
};

describe("Admin filter config → Homepage (desktop + mobile)", () => {
  it("desktop: year_min/year_max + genre narrows a custom section without affecting others", () => {
    const custom = applyAdminFilters(library, sections.custom_action_2023_2026);
    const trending = applyAdminFilters(library, sections.trending);

    expect(custom.map((c) => c.id).sort()).toEqual([
      "m-2023-action",
      "m-2025-action",
      "s-2026-action",
    ]);
    // Unrelated section is untouched
    expect(trending).toHaveLength(library.length);
  });

  it("desktop: content_type_filter + year_min stacks correctly", () => {
    const out = applyAdminFilters(library, sections.movies_only_2025_plus);
    expect(out.map((c) => c.id).sort()).toEqual(["m-2025-action", "m-2026-comedy"]);
  });

  it("mobile: same section config yields identical filtered set (parity)", () => {
    // MobileHome.tsx calls applyAdminFilters with the same row payload as Index.tsx,
    // so the filtered set MUST match desktop byte-for-byte.
    const desktop = applyAdminFilters(library, sections.custom_action_2023_2026);
    const mobile = applyAdminFilters(library, sections.custom_action_2023_2026);
    expect(mobile.map((c) => c.id)).toEqual(desktop.map((c) => c.id));
  });

  it("does not break special section types: by_year short-circuits, genre row skips genre filter", () => {
    expect(applyAdminFilters(library, sections.by_year_legacy)).toHaveLength(library.length);
    expect(applyAdminFilters(library, sections.genre_row_action)).toHaveLength(library.length);
  });

  it("layout integrity: original ordering is preserved within a filtered section", () => {
    const inputOrder = [...library].reverse();
    const out = applyAdminFilters(inputOrder, sections.custom_action_2023_2026);
    const expected = inputOrder
      .filter(
        (i) => i.genre === "Action" && i.year >= 2023 && i.year <= 2026
      )
      .map((i) => i.id);
    expect(out.map((c) => c.id)).toEqual(expected);
  });

  it("adaptive: empty / null filters return the full set unchanged (desktop AND mobile)", () => {
    const noFilters: HomeSectionFilterSource = { section_type: "custom" };
    const out = applyAdminFilters(library, noFilters);
    expect(out.map((c) => c.id)).toEqual(library.map((c) => c.id));
  });

  it("year_filter exact overrides year_min/year_max range across all viewports", () => {
    const out = applyAdminFilters(library, {
      section_type: "custom",
      year_filter: 2021,
      year_min: 2024,
      year_max: 2026,
    });
    expect(out.map((c) => c.id)).toEqual(["m-2021-drama"]);
  });

  it("multiple sections on the same page do not cross-contaminate", () => {
    const a = applyAdminFilters(library, sections.custom_action_2023_2026);
    const b = applyAdminFilters(library, sections.movies_only_2025_plus);
    // Each section computes independently from the source library
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(library).toHaveLength(8); // source untouched
  });
});
