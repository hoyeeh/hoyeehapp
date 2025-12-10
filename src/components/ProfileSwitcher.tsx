import { useState } from "react";
import { useProfileContext, UserProfile } from "@/contexts/ProfileContext";
import { Baby, ChevronDown, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ProfileSwitcherProps {
  onManageProfiles?: () => void;
}

export const ProfileSwitcher = ({ onManageProfiles }: ProfileSwitcherProps) => {
  const { profiles, currentProfile, setCurrentProfile } = useProfileContext();

  if (!currentProfile) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none">
        <div
          className={cn(
            "w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm",
            currentProfile.avatar_url || "bg-brand"
          )}
        >
          {currentProfile.is_kids ? (
            <Baby className="w-4 h-4" />
          ) : (
            currentProfile.name.charAt(0).toUpperCase()
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
            <div
              className={cn(
                "w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs",
                profile.avatar_url || "bg-brand"
              )}
            >
              {profile.is_kids ? (
                <Baby className="w-4 h-4" />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
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
