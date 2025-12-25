// Filter for kids-appropriate content (G and PG ratings only)
export const KIDS_RATINGS = ["G", "PG"];

// Maximum age limit for kids content - STRICT: Only content for ages 13 and under
export const KIDS_MAX_AGE_LIMIT = 13;

// Genres allowed in Kids Zone - ONLY Animation and Family
export const KIDS_ALLOWED_GENRES = ["animation", "family", "animated", "cartoon"];

// Helper function to check if content has an allowed kids genre
export const isKidsAllowedGenre = (genre: string | null | undefined): boolean => {
  if (!genre) return false;
  const normalizedGenre = genre.toLowerCase();
  return KIDS_ALLOWED_GENRES.some(allowed => normalizedGenre.includes(allowed));
};

// Titles that should NEVER appear in the Kids Zone
export const KIDS_BLOCKED_TITLES = [
  "Spermageddon",
  "Together",
  "The Wailing"
];

// Helper function to check if a title is blocked
export const isBlockedTitle = (title: string): boolean => {
  const normalizedTitle = title.toLowerCase().trim();
  return KIDS_BLOCKED_TITLES.some(blocked => 
    normalizedTitle === blocked.toLowerCase() ||
    normalizedTitle.includes(blocked.toLowerCase())
  );
};
