import { useProfileContext } from "@/contexts/ProfileContext";
import { useProfile } from "@/hooks/useDatabase";
import { Baby, ChevronDown, User, Crown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { getRingById } from "@/lib/avatars";

interface ProfileSwitcherProps {
  onManageProfiles?: () => void;
}

// Parse avatar data for display
const parseAvatarData = (avatarUrl: string | null) => {
  if (!avatarUrl) return { src: "", ring: "none" };
  const [baseSrc, params] = avatarUrl.split("?");
  let ring = "none";
  if (params) {
    const ringMatch = params.match(/ring=([^&]+)/);
    ring = ringMatch ? ringMatch[1] : "none";
  }
  return { src: baseSrc, ring };
};

export const ProfileSwitcher = ({ onManageProfiles }: ProfileSwitcherProps) => {
  const { profiles, currentProfile, setCurrentProfile } = useProfileContext();
  const { data: userProfile } = useProfile();
  const isSubscribed = userProfile?.is_subscribed;

  if (!currentProfile) return null;

  const { src: currentSrc, ring: currentRing } = parseAvatarData(currentProfile.avatar_url);
  const currentRingData = getRingById(currentRing);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none">
        <div className="relative">
          <motion.div
            key={currentProfile.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {currentRingData.gradient ? (
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
                style={{ 
                  background: currentRingData.gradient,
                  padding: "2px",
                }}
              >
                <div className="w-full h-full bg-background rounded-lg overflow-hidden">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={currentSrc || undefined} alt={currentProfile.name} className="object-cover" />
                    <AvatarFallback className="bg-brand text-white font-bold text-sm">
                      {currentProfile.is_kids ? (
                        <Baby className="w-4 h-4" />
                      ) : (
                        currentProfile.name.charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            ) : (
              <Avatar className={cn("w-8 h-8 sm:w-10 sm:h-10", currentRingData.className)}>
                <AvatarImage src={currentSrc || undefined} alt={currentProfile.name} className="object-cover" />
                <AvatarFallback className="bg-brand text-white font-bold text-sm">
                  {currentProfile.is_kids ? (
                    <Baby className="w-4 h-4" />
                  ) : (
                    currentProfile.name.charAt(0).toUpperCase()
                  )}
                </AvatarFallback>
              </Avatar>
            )}
          </motion.div>
          {isSubscribed && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center"
            >
              <Crown className="w-2.5 h-2.5 text-white" />
            </motion.div>
          )}
        </div>
        <span className="hidden md:block text-sm font-medium truncate max-w-24">
          {currentProfile.name}
        </span>
        <ChevronDown className="h-4 w-4 hidden md:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <AnimatePresence mode="popLayout">
          {profiles.map((profile, index) => {
            const { src, ring } = parseAvatarData(profile.avatar_url);
            const ringData = getRingById(ring);
            
            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  onClick={() => setCurrentProfile(profile)}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer",
                    profile.id === currentProfile.id && "bg-accent"
                  )}
                >
                  {ringData.gradient ? (
                    <div 
                      className="w-8 h-8 rounded-lg"
                      style={{ 
                        background: ringData.gradient,
                        padding: "2px",
                      }}
                    >
                      <div className="w-full h-full bg-background rounded-lg overflow-hidden">
                        <Avatar className="w-full h-full">
                          <AvatarImage src={src || undefined} alt={profile.name} className="object-cover" />
                          <AvatarFallback className="bg-brand text-white font-bold text-xs">
                            {profile.is_kids ? (
                              <Baby className="w-4 h-4" />
                            ) : (
                              profile.name.charAt(0).toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  ) : (
                    <Avatar className={cn("w-8 h-8", ringData.className)}>
                      <AvatarImage src={src || undefined} alt={profile.name} className="object-cover" />
                      <AvatarFallback className="bg-brand text-white font-bold text-xs">
                        {profile.is_kids ? (
                          <Baby className="w-4 h-4" />
                        ) : (
                          profile.name.charAt(0).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className={cn(
                    "text-sm",
                    profile.is_kids && "text-cyan-400"
                  )}>
                    {profile.name}
                  </span>
                </DropdownMenuItem>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={onManageProfiles}
          className="flex items-center gap-3 cursor-pointer"
        >
          <User className="w-4 h-4" />
          <span className="text-sm">Manage Profiles</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
