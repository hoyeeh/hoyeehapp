// Centralized avatar definitions for the entire app
import badibadi from "@/assets/avatars/badibadi.png";
import camel from "@/assets/avatars/camel.png";
import ehma from "@/assets/avatars/ehma.png";
import horse from "@/assets/avatars/horse.png";
import lydi from "@/assets/avatars/lydi.png";
import maki from "@/assets/avatars/maki.png";
import rons from "@/assets/avatars/rons.png";
import rooster from "@/assets/avatars/rooster.png";
import shon from "@/assets/avatars/shon.png";
import zebra from "@/assets/avatars/zebra.png";
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
  "/avatars/badibadi.png": badibadi,
  "/avatars/camel.png": camel,
  "/avatars/ehma.png": ehma,
  "/avatars/horse.png": horse,
  "/avatars/lydi.png": lydi,
  "/avatars/maki.png": maki,
  "/avatars/rons.png": rons,
  "/avatars/rooster.png": rooster,
  "/avatars/shon.png": shon,
  "/avatars/zebra.png": zebra,
  "/avatars/deer.png": deer,
  "/avatars/panther.png": panther,
};

// Main avatars for all users (12 total)
export const AVATARS: Avatar[] = [
  { src: badibadi, urlPath: "/avatars/badibadi.png", name: "BadiBadi", category: "characters" },
  { src: camel, urlPath: "/avatars/camel.png", name: "Camel", category: "animals" },
  { src: deer, urlPath: "/avatars/deer.png", name: "Deer", category: "animals" },
  { src: ehma, urlPath: "/avatars/ehma.png", name: "Ehma", category: "characters" },
  { src: horse, urlPath: "/avatars/horse.png", name: "Horse", category: "animals" },
  { src: lydi, urlPath: "/avatars/lydi.png", name: "Lydi", category: "characters" },
  { src: maki, urlPath: "/avatars/maki.png", name: "Maki", category: "characters" },
  { src: panther, urlPath: "/avatars/panther.png", name: "Panther", category: "animals" },
  { src: rons, urlPath: "/avatars/rons.png", name: "Rons", category: "characters" },
  { src: rooster, urlPath: "/avatars/rooster.png", name: "Rooster", category: "animals" },
  { src: shon, urlPath: "/avatars/shon.png", name: "Shon", category: "characters" },
  { src: zebra, urlPath: "/avatars/zebra.png", name: "Zebra", category: "animals" },
];

// Kids-specific avatars with friendly character names
export const KIDS_AVATARS: Avatar[] = [
  { src: lydi, urlPath: "/avatars/lydi.png", name: "Sunny", category: "characters", isKidsOnly: true },
  { src: ehma, urlPath: "/avatars/ehma.png", name: "Sprout", category: "characters", isKidsOnly: true },
  { src: rons, urlPath: "/avatars/rons.png", name: "Buddy", category: "characters", isKidsOnly: true },
  { src: shon, urlPath: "/avatars/shon.png", name: "Star", category: "characters", isKidsOnly: true },
  { src: camel, urlPath: "/avatars/camel.png", name: "Sandy", category: "animals", isKidsOnly: true },
  { src: zebra, urlPath: "/avatars/zebra.png", name: "Zippy", category: "animals", isKidsOnly: true },
  { src: horse, urlPath: "/avatars/horse.png", name: "Clover", category: "animals", isKidsOnly: true },
  { src: rooster, urlPath: "/avatars/rooster.png", name: "Sunrise", category: "animals", isKidsOnly: true },
  { src: maki, urlPath: "/avatars/maki.png", name: "Spark", category: "characters", isKidsOnly: true },
  { src: badibadi, urlPath: "/avatars/badibadi.png", name: "Hero", category: "characters", isKidsOnly: true },
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
