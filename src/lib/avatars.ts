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
  src: string;
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

// Main avatars for all users
export const AVATARS: Avatar[] = [
  { src: hoyeehBlack, name: "Monster Black" },
  { src: hoyeehBlue, name: "Monster Blue" },
  { src: hoyeehBrown, name: "Monster Brown" },
  { src: hoyeehGreen, name: "Monster Green" },
  { src: hoyeehLilac, name: "Monster Lilac" },
  { src: hoyeehPurple, name: "Monster Purple" },
  { src: hoyeehRed, name: "Monster Red" },
  { src: hoyeehYellow, name: "Monster Yellow" },
];

// Kids-specific avatars with friendly characters
export const KIDS_AVATARS: Avatar[] = [
  { src: hoyeehYellow, name: "Sunny", isKidsOnly: true },
  { src: hoyeehGreen, name: "Sprout", isKidsOnly: true },
  { src: hoyeehBlue, name: "Bubble", isKidsOnly: true },
  { src: hoyeehLilac, name: "Dreamy", isKidsOnly: true },
  { src: hoyeehPurple, name: "Magic", isKidsOnly: true },
  { src: hoyeehBrown, name: "Cocoa", isKidsOnly: true },
  { src: hoyeehRed, name: "Cherry", isKidsOnly: true },
  { src: hoyeehBlack, name: "Shadow", isKidsOnly: true },
];

// Get avatars based on profile type
export const getAvatarsForProfile = (isKids: boolean): Avatar[] => {
  return isKids ? KIDS_AVATARS : AVATARS;
};

// Helper function to get a random avatar
export const getRandomAvatar = (isKids: boolean = false): string => {
  const avatars = isKids ? KIDS_AVATARS : AVATARS;
  const randomIndex = Math.floor(Math.random() * avatars.length);
  return avatars[randomIndex].src;
};

// Helper function to get a random ring
export const getRandomRing = (): string => {
  const rings = AVATAR_RINGS.filter(r => r.id !== "none");
  const randomIndex = Math.floor(Math.random() * rings.length);
  return rings[randomIndex].id;
};

// Helper function to find avatar by URL
export const findAvatarByUrl = (url: string | null | undefined): Avatar | undefined => {
  if (!url) return undefined;
  return [...AVATARS, ...KIDS_AVATARS].find(a => a.src === url);
};

// Check if a URL is one of our preset avatars
export const isPresetAvatar = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return [...AVATARS, ...KIDS_AVATARS].some(a => a.src === url);
};

// Get ring by ID
export const getRingById = (id: string | null | undefined): AvatarRing => {
  if (!id) return AVATAR_RINGS[0];
  return AVATAR_RINGS.find(r => r.id === id) || AVATAR_RINGS[0];
};
