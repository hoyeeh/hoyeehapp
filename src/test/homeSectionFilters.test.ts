import { describe, it, expect } from "vitest";
import { applyAdminFilters } from "@/lib/homeSectionFilters";

const items = [
  { id: "a", contentType: "movie", year: 2020, genre: "Action" },
  { id: "b", contentType: "movie", year: 2024, genre: "Drama" },
  { id: "c", contentType: "series", year: 2023, genre: "Action" },
  { id: "d", contentType: "series", year: 2019, genre: "Comedy" },
  { id: "e", contentType: "movie", year: 2026, genre: "Action" },
] as const;

describe("applyAdminFilters", () => {
  it("returns items unchanged when no filters are set", () => {
    expect(applyAdminFilters([...items], { section_type: "custom" })).toHaveLength(items.length);
  });

  it("filters by content_type_filter", () => {
    const out = applyAdminFilters([...items], { section_type: "custom", content_type_filter: "series" });
    expect(out.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("filters by exact year_filter", () => {
    const out = applyAdminFilters([...items], { section_type: "custom", year_filter: 2024 });
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by year_min / year_max range", () => {
    const out = applyAdminFilters([...items], { section_type: "custom", year_min: 2023, year_max: 2025 });
    expect(out.map((i) => i.id).sort()).toEqual(["b", "c"]);
  });

  it("year_filter overrides range when both set", () => {
    const out = applyAdminFilters([...items], {
      section_type: "custom",
      year_filter: 2019,
      year_min: 2024,
      year_max: 2026,
    });
    expect(out.map((i) => i.id)).toEqual(["d"]);
  });

  it("filters by genre name (case-insensitive substring)", () => {
    const out = applyAdminFilters([...items], { section_type: "custom", genre: { name: "action" } });
    expect(out.map((i) => i.id).sort()).toEqual(["a", "c", "e"]);
  });

  it("skips genre filter when section_type is 'genre' (genre row already scoped)", () => {
    const out = applyAdminFilters([...items], { section_type: "genre", genre: { name: "Action" } });
    expect(out).toHaveLength(items.length);
  });

  it("short-circuits for by_year sections (title-derived year)", () => {
    const out = applyAdminFilters([...items], { section_type: "by_year", year_filter: 1999 });
    expect(out).toHaveLength(items.length);
  });

  it("stacks content_type + genre + year range", () => {
    const out = applyAdminFilters([...items], {
      section_type: "custom",
      content_type_filter: "movie",
      genre: { name: "Action" },
      year_min: 2025,
    });
    expect(out.map((i) => i.id)).toEqual(["e"]);
  });
});
