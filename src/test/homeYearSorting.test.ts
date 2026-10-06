import { describe, it, expect } from "vitest";
import { orderHomepageContent, sortByReleaseDate } from "@/lib/homeContentOrdering";

// Mirrors the sortByYearDesc helper used in src/pages/Index.tsx and
// src/components/mobile/MobileHome.tsx to enforce "most recent year first"
// ordering for every homepage row. If this ever changes, update both call sites.
const sortByYearDesc = <T extends { year?: number | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => (b.year || 0) - (a.year || 0));

type Item = { id: string; year: number | null };

describe("Homepage year ordering (desktop + mobile parity)", () => {
  it("uses exact release date before year and catalogue date", () => {
    const sorted = sortByReleaseDate([
      { id: "older-day", year: 2026, releaseDate: "2026-01-02", createdAt: "2026-09-01" },
      { id: "newer-day", year: 2026, releaseDate: "2026-09-10", createdAt: "2026-01-01" },
      { id: "fallback", year: 2025, createdAt: "2026-10-01" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["newer-day", "older-day", "fallback"]);
  });

  it("preserves explicit curated and Top 10 ordering", () => {
    const items = [
      { id: "admin-first", year: 2020 },
      { id: "admin-second", year: 2026 },
    ];
    expect(orderHomepageContent(items, "curated").map((item) => item.id)).toEqual(["admin-first", "admin-second"]);
    expect(orderHomepageContent(items, "top10").map((item) => item.id)).toEqual(["admin-first", "admin-second"]);
  });
  it("orders items from most recent year to oldest", () => {
    const items: Item[] = [
      { id: "a", year: 2019 },
      { id: "b", year: 2024 },
      { id: "c", year: 2021 },
      { id: "d", year: 2025 },
    ];
    const sorted = sortByYearDesc(items);
    expect(sorted.map((i) => i.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("treats missing/null year as oldest so real items surface first", () => {
    const items: Item[] = [
      { id: "x", year: null },
      { id: "y", year: 2024 },
      { id: "z", year: 2020 },
    ];
    const sorted = sortByYearDesc(items);
    expect(sorted[0].id).toBe("y");
    expect(sorted[sorted.length - 1].id).toBe("x");
  });

  it("does not mutate the input array (persistence-safe / adaptive)", () => {
    const items: Item[] = [
      { id: "a", year: 2020 },
      { id: "b", year: 2024 },
    ];
    const original = [...items];
    sortByYearDesc(items);
    expect(items).toEqual(original);
  });

  it("is stable across repeated calls (persistent ordering)", () => {
    const items: Item[] = [
      { id: "a", year: 2024 },
      { id: "b", year: 2024 },
      { id: "c", year: 2023 },
    ];
    const first = sortByYearDesc(items).map((i) => i.id);
    const second = sortByYearDesc(items).map((i) => i.id);
    expect(first).toEqual(second);
  });

  it("handles empty arrays without breaking row structure", () => {
    expect(sortByYearDesc([])).toEqual([]);
  });
});
