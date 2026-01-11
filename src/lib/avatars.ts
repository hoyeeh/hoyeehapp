// Centralized avatar definitions for the entire app
// Using cloud storage URLs instead of local imports

// Cloud storage base URL
const STORAGE_URL = "https://astugmzoxhxcyipxsojl.supabase.co/storage/v1/object/public/avatars";

// Avatar URLs from cloud storage
const badibadi = `${STORAGE_URL}/BadiBadi.png`;
const camel = `${STORAGE_URL}/Camel.png`;
const deer = `${STORAGE_URL}/Deer.png`;
const ehma = `${STORAGE_URL}/Ehma.png`;
const horse = `${STORAGE_URL}/Horse.png`;
const lydi = `${STORAGE_URL}/Lydi.png`;
const maki = `${STORAGE_URL}/Maki.png`;
const panther = `${STORAGE_URL}/Panther.png`;
const rons = `${STORAGE_URL}/Rons.png`;
const rooster = `${STORAGE_URL}/Rooster.png`;
const shon = `${STORAGE_URL}/Shon.png`;
const zebra = `${STORAGE_URL}/Zebra.png`;

export type AvatarCategory = "animals" | "humans";

export interface Avatar {
  src: string;       // URL for display
  urlPath: string;   // URL path for database storage
  name: string;
  category: AvatarCategory;
  isKidsOnly?: boolean;
}

// Color ring options for avatar customization
export interface AvatarRing {
  id: string;
  name: string;
  className: string; // Tailwind ring classes
  gradient?: string; // For gradient rings
}

export const AVATAR_RINGS: AvatarRing[] = [
  { id: "none", name: "None", className: "" },
  { id: "orange", name: "Orange", className: "ring-4 ring-orange-500" },
  { id: "blue", name: "Blue", className: "ring-4 ring-blue-500" },
  { id: "green", name: "Green", className: "ring-4 ring-green-500" },
  { id: "purple", name: "Purple", className: "ring-4 ring-purple-500" },
  { id: "pink", name: "Pink", className: "ring-4 ring-pink-500" },
  { id: "cyan", name: "Cyan", className: "ring-4 ring-cyan-500" },
  { id: "amber", name: "Gold", className: "ring-4 ring-amber-400" },
  { id: "rainbow", name: "Rainbow", className: "ring-4", gradient: "conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0080, #ff0000)" },
];

// Category metadata for UI display
export const AVATAR_CATEGORIES: { id: AvatarCategory; label: string; icon: string }[] = [
  { id: "humans", label: "Humans", icon: "👤" },
  { id: "animals", label: "Animals", icon: "🦁" },
];

// Main avatars for all users (12 total)
export const AVATARS: Avatar[] = [
  // Human characters
  { src: badibadi, urlPath: badibadi, name: "BadiBadi", category: "humans" },
  { src: ehma, urlPath: ehma, name: "Ehma", category: "humans" },
  { src: lydi, urlPath: lydi, name: "Lydi", category: "humans" },
  { src: rons, urlPath: rons, name: "Rons", category: "humans" },
  { src: shon, urlPath: shon, name: "Shon", category: "humans" },
  { src: maki, urlPath: maki, name: "Maki", category: "humans" },
  // Animal characters
  { src: camel, urlPath: camel, name: "Camel", category: "animals" },
  { src: deer, urlPath: deer, name: "Deer", category: "animals" },
  { src: horse, urlPath: horse, name: "Horse", category: "animals" },
  { src: panther, urlPath: panther, name: "Panther", category: "animals" },
  { src: rooster, urlPath: rooster, name: "Rooster", category: "animals" },
  { src: zebra, urlPath: zebra, name: "Zebra", category: "animals" },
];

// Kids-specific avatars with friendly character names
export const KIDS_AVATARS: Avatar[] = [
  // Human characters with kid-friendly names
  { src: lydi, urlPath: lydi, name: "Sunny", category: "humans", isKidsOnly: true },
  { src: ehma, urlPath: ehma, name: "Sprout", category: "humans", isKidsOnly: true },
  { src: rons, urlPath: rons, name: "Buddy", category: "humans", isKidsOnly: true },
  { src: shon, urlPath: shon, name: "Star", category: "humans", isKidsOnly: true },
  { src: maki, urlPath: maki, name: "Spark", category: "humans", isKidsOnly: true },
  { src: badibadi, urlPath: badibadi, name: "Hero", category: "humans", isKidsOnly: true },
  // Animal characters with kid-friendly names
  { src: camel, urlPath: camel, name: "Sandy", category: "animals", isKidsOnly: true },
  { src: zebra, urlPath: zebra, name: "Zippy", category: "animals", isKidsOnly: true },
  { src: horse, urlPath: horse, name: "Clover", category: "animals", isKidsOnly: true },
  { src: rooster, urlPath: rooster, name: "Sunrise", category: "animals", isKidsOnly: true },
  { src: panther, urlPath: panther, name: "Shadow", category: "animals", isKidsOnly: true },
  { src: deer, urlPath: deer, name: "Bambi", category: "animals", isKidsOnly: true },
];

// Get avatars based on profile type
export const getAvatarsForProfile = (isKids: boolean): Avatar[] => {
  return isKids ? KIDS_AVATARS : AVATARS;
};

// Get avatars grouped by category
export const getAvatarsByCategory = (isKids: boolean): Record<AvatarCategory, Avatar[]> => {
  const avatars = getAvatarsForProfile(isKids);
  const grouped: Record<AvatarCategory, Avatar[]> = {
    humans: [],
    animals: [],
  };
  
  avatars.forEach(avatar => {
    grouped[avatar.category].push(avatar);
  });
  
  return grouped;
};

// Helper function to get a random avatar URL path (for database storage)
export const getRandomAvatar = (isKids: boolean = false): string => {
  const avatars = isKids ? KIDS_AVATARS : AVATARS;
  const randomIndex = Math.floor(Math.random() * avatars.length);
  return avatars[randomIndex].urlPath;
};

// Helper function to get a random ring
export const getRandomRing = (): string => {
  const rings = AVATAR_RINGS.filter(r => r.id !== "none");
  const randomIndex = Math.floor(Math.random() * rings.length);
  return rings[randomIndex].id;
};

// Helper function to find avatar by URL path
export const findAvatarByUrl = (url: string | null | undefined): Avatar | undefined => {
  if (!url) return undefined;
  // Remove ring query param if present
  const basePath = url.split("?")[0];
  return [...AVATARS, ...KIDS_AVATARS].find(a => a.urlPath === basePath || a.src === basePath);
};

// Check if a URL is one of our preset avatars
export const isPresetAvatar = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const basePath = url.split("?")[0];
  return [...AVATARS, ...KIDS_AVATARS].some(a => a.urlPath === basePath || a.src === basePath);
};

// Get ring by ID
export const getRingById = (id: string | null | undefined): AvatarRing => {
  if (!id) return AVATAR_RINGS[0];
  return AVATAR_RINGS.find(r => r.id === id) || AVATAR_RINGS[0];
};

// Resolve a database URL to a displayable image source
export const resolveAvatarSrc = (url: string | null | undefined): string => {
  if (!url) return AVATARS[0].src;
  const basePath = url.split("?")[0];
  
  // Check if it matches an avatar's urlPath or src
  const avatar = [...AVATARS, ...KIDS_AVATARS].find(a => a.urlPath === basePath || a.src === basePath);
  if (avatar) {
    return avatar.src;
  }
  
  // Return as-is (could be external URL or custom avatar)
  return basePath;
};

// Get avatar URL path for database storage from display src
export const getAvatarUrlPath = (src: string): string => {
  const avatar = [...AVATARS, ...KIDS_AVATARS].find(a => a.src === src);
  return avatar ? avatar.urlPath : src;
};
