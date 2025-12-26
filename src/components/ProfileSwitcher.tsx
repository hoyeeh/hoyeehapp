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

interface ProfileSwitcherProps {
  onManageProfiles?: () => void;
}

export const ProfileSwitcher = ({ onManageProfiles }: ProfileSwitcherProps) => {
  const { profiles, currentProfile, setCurrentProfile } = useProfileContext();
  const { data: userProfile } = useProfile();
  const isSubscribed = userProfile?.is_subscribed;

  if (!currentProfile) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none">
        <div className="relative">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
            <AvatarImage src={currentProfile.avatar_url || undefined} alt={currentProfile.name} className="object-cover" />
            <AvatarFallback className={cn(
              "text-white font-bold text-sm",
              "bg-brand"
            )}>
              {currentProfile.is_kids ? (
                <Baby className="w-4 h-4" />
              ) : (
                currentProfile.name.charAt(0).toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>
          {isSubscribed && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
              <Crown className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        <span className="hidden md:block text-sm font-medium truncate max-w-24">
          {currentProfile.name}
        </span>
        <ChevronDown className="h-4 w-4 hidden md:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => setCurrentProfile(profile)}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              profile.id === currentProfile.id && "bg-accent"
            )}
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.name} className="object-cover" />
              <AvatarFallback className="bg-brand text-white font-bold text-xs">
                {profile.is_kids ? (
                  <Baby className="w-4 h-4" />
                ) : (
                  profile.name.charAt(0).toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-sm",
              profile.is_kids && "text-cyan-400"
            )}>
              {profile.name}
            </span>
          </DropdownMenuItem>
        ))}

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
