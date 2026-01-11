import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  getAvatarsByCategory, 
  AVATAR_CATEGORIES, 
  type Avatar 
} from "@/lib/avatars";

interface AvatarCategoryGridProps {
  isKids: boolean;
  selectedAvatarSrc: string;
  onSelect: (avatar: Avatar) => void;
  className?: string;
}

export function AvatarCategoryGrid({
  isKids,
  selectedAvatarSrc,
  onSelect,
  className,
}: AvatarCategoryGridProps) {
  const avatarsByCategory = getAvatarsByCategory(isKids);

  return (
    <div className={cn("space-y-4", className)}>
      {AVATAR_CATEGORIES.map((category) => {
        const avatars = avatarsByCategory[category.id];
        if (!avatars || avatars.length === 0) return null;

        return (
          <div key={category.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{category.icon}</span>
              <span className="text-sm font-medium text-muted-foreground">
                {category.label}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {avatars.map((avatar, i) => (
                <motion.button
                  key={avatar.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "aspect-square rounded-lg overflow-hidden transition-all",
                    selectedAvatarSrc === avatar.src 
                      ? "ring-2 ring-offset-2 ring-brand scale-105" 
                      : "opacity-70 hover:opacity-100"
                  )}
                  onClick={() => onSelect(avatar)}
                >
                  <img 
                    src={avatar.src} 
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
