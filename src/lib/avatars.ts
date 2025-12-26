// Centralized avatar definitions for the entire app
import hoyeehBlack from "@/assets/avatars/hoyeeh-black.png";
import hoyeehBlue from "@/assets/avatars/hoyeeh-blue.png";
import hoyeehBrown from "@/assets/avatars/hoyeeh-brown.png";
import hoyeehGreen from "@/assets/avatars/hoyeeh-green.png";
import hoyeehLilac from "@/assets/avatars/hoyeeh-lilac.png";
import hoyeehPurple from "@/assets/avatars/hoyeeh-purple.png";
import hoyeehRed from "@/assets/avatars/hoyeeh-red.png";
import hoyeehYellow from "@/assets/avatars/hoyeeh-yellow.png";

export interface Avatar {
  src: string;       // ES6 bundled import path for display
  urlPath: string;   // URL path for database storage
  name: string;
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

// Mapping from URL paths to ES6 imports
const URL_TO_IMPORT: Record<string, string> = {
  "/avatars/hoyeeh-black.png": hoyeehBlack,
  "/avatars/hoyeeh-blue.png": hoyeehBlue,
  "/avatars/hoyeeh-brown.png": hoyeehBrown,
  "/avatars/hoyeeh-green.png": hoyeehGreen,
  "/avatars/hoyeeh-lilac.png": hoyeehLilac,
  "/avatars/hoyeeh-purple.png": hoyeehPurple,
  "/avatars/hoyeeh-red.png": hoyeehRed,
  "/avatars/hoyeeh-yellow.png": hoyeehYellow,
};

// Main avatars for all users
export const AVATARS: Avatar[] = [
  { src: hoyeehBlack, urlPath: "/avatars/hoyeeh-black.png", name: "Monster Black" },
  { src: hoyeehBlue, urlPath: "/avatars/hoyeeh-blue.png", name: "Monster Blue" },
  { src: hoyeehBrown, urlPath: "/avatars/hoyeeh-brown.png", name: "Monster Brown" },
  { src: hoyeehGreen, urlPath: "/avatars/hoyeeh-green.png", name: "Monster Green" },
  { src: hoyeehLilac, urlPath: "/avatars/hoyeeh-lilac.png", name: "Monster Lilac" },
  { src: hoyeehPurple, urlPath: "/avatars/hoyeeh-purple.png", name: "Monster Purple" },
  { src: hoyeehRed, urlPath: "/avatars/hoyeeh-red.png", name: "Monster Red" },
  { src: hoyeehYellow, urlPath: "/avatars/hoyeeh-yellow.png", name: "Monster Yellow" },
];

// Kids-specific avatars with friendly characters
export const KIDS_AVATARS: Avatar[] = [
  { src: hoyeehYellow, urlPath: "/avatars/hoyeeh-yellow.png", name: "Sunny", isKidsOnly: true },
  { src: hoyeehGreen, urlPath: "/avatars/hoyeeh-green.png", name: "Sprout", isKidsOnly: true },
  { src: hoyeehBlue, urlPath: "/avatars/hoyeeh-blue.png", name: "Bubble", isKidsOnly: true },
  { src: hoyeehLilac, urlPath: "/avatars/hoyeeh-lilac.png", name: "Dreamy", isKidsOnly: true },
  { src: hoyeehPurple, urlPath: "/avatars/hoyeeh-purple.png", name: "Magic", isKidsOnly: true },
  { src: hoyeehBrown, urlPath: "/avatars/hoyeeh-brown.png", name: "Cocoa", isKidsOnly: true },
  { src: hoyeehRed, urlPath: "/avatars/hoyeeh-red.png", name: "Cherry", isKidsOnly: true },
  { src: hoyeehBlack, urlPath: "/avatars/hoyeeh-black.png", name: "Shadow", isKidsOnly: true },
];

// Get avatars based on profile type
export const getAvatarsForProfile = (isKids: boolean): Avatar[] => {
  return isKids ? KIDS_AVATARS : AVATARS;
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
