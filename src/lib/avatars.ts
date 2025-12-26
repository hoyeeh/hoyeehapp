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
}

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

// Helper function to get a random avatar
export const getRandomAvatar = (): string => {
  const randomIndex = Math.floor(Math.random() * AVATARS.length);
  return AVATARS[randomIndex].src;
};

// Helper function to find avatar by URL
export const findAvatarByUrl = (url: string | null | undefined): Avatar | undefined => {
  if (!url) return undefined;
  return AVATARS.find(a => a.src === url);
};

// Check if a URL is one of our preset avatars
export const isPresetAvatar = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return AVATARS.some(a => a.src === url);
};
