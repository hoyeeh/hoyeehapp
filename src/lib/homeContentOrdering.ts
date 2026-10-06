export interface ReleaseOrderedContent {
  releaseDate?: string | null;
  year?: number | null;
  createdAt?: string | null;
}

const timestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** Exact release date wins, then release year, then catalogue-added time. */
export function sortByReleaseDate<T extends ReleaseOrderedContent>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const releaseDiff = timestamp(b.releaseDate) - timestamp(a.releaseDate);
    if (releaseDiff !== 0) return releaseDiff;
    const yearDiff = (b.year ?? 0) - (a.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return timestamp(b.createdAt) - timestamp(a.createdAt);
  });
}

/** Admin-curated and ranked rows retain their explicit database order. */
export function orderHomepageContent<T extends ReleaseOrderedContent>(
  items: T[],
  sectionType?: string | null,
): T[] {
  if (sectionType === "curated" || sectionType === "top10") return [...items];
  return sortByReleaseDate(items);
}