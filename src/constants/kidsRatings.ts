// Admin Kids catalogue contract: only G-rated content.
export const KIDS_RATINGS = ["G"];

// Admin Kids catalogue contract: only content for ages 12 and under.
export const KIDS_MAX_AGE_LIMIT = 12;

// Genres allowed in Kids Zone - ONLY Animation and Family
export const KIDS_ALLOWED_GENRES = ["animation", "family", "animated", "cartoon"];

// Helper function to check if content has an allowed kids genre
export const isKidsAllowedGenre = (genre: string | null | undefined): boolean => {
  if (!genre) return false;
  const normalizedGenre = genre.toLowerCase();
  return KIDS_ALLOWED_GENRES.some(allowed => normalizedGenre.includes(allowed));
};

export const isKidsContentAllowed = (content: {
  contentRating?: string | null;
  content_rating?: string | null;
  ageLimit?: number | null;
  age_limit?: number | null;
  genre?: string | null;
  title?: string | null;
}): boolean => {
  const rating = content.contentRating ?? content.content_rating;
  const ageLimit = content.ageLimit ?? content.age_limit;
  return !!rating
    && KIDS_RATINGS.includes(rating)
    && (!ageLimit || ageLimit <= KIDS_MAX_AGE_LIMIT)
    && isKidsAllowedGenre(content.genre)
    && !isBlockedTitle(content.title ?? "");
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
