// Centralized avatar definitions for the entire app
import avatarBasketball from "@/assets/avatars/avatar-basketball.png";
import avatarBlue from "@/assets/avatars/avatar-blue.png";
import avatarCowboy from "@/assets/avatars/avatar-cowboy.png";
import avatarGold from "@/assets/avatars/avatar-gold.png";
import avatarGreen from "@/assets/avatars/avatar-green.png";
import avatarPurple from "@/assets/avatars/avatar-purple.png";
import avatarRed from "@/assets/avatars/avatar-red.png";
import avatarUnicorn from "@/assets/avatars/avatar-unicorn.png";
import avatarYellow from "@/assets/avatars/avatar-yellow.png";
import deer from "@/assets/avatars/deer.png";
import panther from "@/assets/avatars/panther.png";

export type AvatarCategory = "animals" | "characters";

export interface Avatar {
  src: string;       // ES6 bundled import path for display
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
  { id: "animals", label: "Animals", icon: "🦁" },
  { id: "characters", label: "Characters", icon: "😊" },
];

// Mapping from URL paths to ES6 imports
const URL_TO_IMPORT: Record<string, string> = {
  "/avatars/avatar-basketball.png": avatarBasketball,
  "/avatars/avatar-blue.png": avatarBlue,
  "/avatars/avatar-cowboy.png": avatarCowboy,
  "/avatars/avatar-gold.png": avatarGold,
  "/avatars/avatar-green.png": avatarGreen,
  "/avatars/avatar-purple.png": avatarPurple,
  "/avatars/avatar-red.png": avatarRed,
  "/avatars/avatar-unicorn.png": avatarUnicorn,
  "/avatars/avatar-yellow.png": avatarYellow,
  "/avatars/deer.png": deer,
  "/avatars/panther.png": panther,
};

// Main avatars for all users (11 total)
export const AVATARS: Avatar[] = [
  { src: avatarBasketball, urlPath: "/avatars/avatar-basketball.png", name: "Basketball", category: "characters" },
  { src: avatarBlue, urlPath: "/avatars/avatar-blue.png", name: "Blue", category: "characters" },
  { src: avatarCowboy, urlPath: "/avatars/avatar-cowboy.png", name: "Cowboy", category: "characters" },
  { src: avatarGold, urlPath: "/avatars/avatar-gold.png", name: "Gold", category: "characters" },
  { src: avatarGreen, urlPath: "/avatars/avatar-green.png", name: "Green", category: "characters" },
  { src: avatarPurple, urlPath: "/avatars/avatar-purple.png", name: "Purple", category: "characters" },
  { src: avatarRed, urlPath: "/avatars/avatar-red.png", name: "Red", category: "characters" },
  { src: avatarUnicorn, urlPath: "/avatars/avatar-unicorn.png", name: "Unicorn", category: "characters" },
  { src: avatarYellow, urlPath: "/avatars/avatar-yellow.png", name: "Yellow", category: "characters" },
  { src: deer, urlPath: "/avatars/deer.png", name: "Deer", category: "animals" },
  { src: panther, urlPath: "/avatars/panther.png", name: "Panther", category: "animals" },
];

// Kids-specific avatars with friendly character names
export const KIDS_AVATARS: Avatar[] = [
  { src: avatarUnicorn, urlPath: "/avatars/avatar-unicorn.png", name: "Sparkle", category: "characters", isKidsOnly: true },
  { src: avatarBasketball, urlPath: "/avatars/avatar-basketball.png", name: "Sporty", category: "characters", isKidsOnly: true },
  { src: avatarCowboy, urlPath: "/avatars/avatar-cowboy.png", name: "Ranger", category: "characters", isKidsOnly: true },
  { src: avatarBlue, urlPath: "/avatars/avatar-blue.png", name: "Sky", category: "characters", isKidsOnly: true },
  { src: avatarGreen, urlPath: "/avatars/avatar-green.png", name: "Leaf", category: "characters", isKidsOnly: true },
  { src: avatarPurple, urlPath: "/avatars/avatar-purple.png", name: "Grape", category: "characters", isKidsOnly: true },
  { src: avatarRed, urlPath: "/avatars/avatar-red.png", name: "Cherry", category: "characters", isKidsOnly: true },
  { src: avatarYellow, urlPath: "/avatars/avatar-yellow.png", name: "Sunny", category: "characters", isKidsOnly: true },
  { src: avatarGold, urlPath: "/avatars/avatar-gold.png", name: "Star", category: "characters", isKidsOnly: true },
  { src: deer, urlPath: "/avatars/deer.png", name: "Bambi", category: "animals", isKidsOnly: true },
  { src: panther, urlPath: "/avatars/panther.png", name: "Shadow", category: "animals", isKidsOnly: true },
];

// Get avatars based on profile type
export const getAvatarsForProfile = (isKids: boolean): Avatar[] => {
  return isKids ? KIDS_AVATARS : AVATARS;
};

// Get avatars grouped by category
export const getAvatarsByCategory = (isKids: boolean): Record<AvatarCategory, Avatar[]> => {
  const avatars = getAvatarsForProfile(isKids);
  const grouped: Record<AvatarCategory, Avatar[]> = {
    animals: [],
    characters: [],
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
  
  // Check if it's a known URL path and convert to ES6 import
  if (URL_TO_IMPORT[basePath]) {
    return URL_TO_IMPORT[basePath];
  }
  
  // Check if it matches an avatar's urlPath
  const avatar = [...AVATARS, ...KIDS_AVATARS].find(a => a.urlPath === basePath);
  if (avatar) {
    return avatar.src;
  }
  
  // Check if it already matches an avatar's src (ES6 import)
  const avatarBySrc = [...AVATARS, ...KIDS_AVATARS].find(a => a.src === basePath);
  if (avatarBySrc) {
    return avatarBySrc.src;
  }
  
  // Return as-is (could be external URL or other valid path)
  return basePath;
};

// Get avatar URL path for database storage from display src
export const getAvatarUrlPath = (src: string): string => {
  const avatar = [...AVATARS, ...KIDS_AVATARS].find(a => a.src === src);
  return avatar ? avatar.urlPath : src;
};
