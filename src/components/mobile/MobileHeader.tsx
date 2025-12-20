import { useState } from "react";
import { Cast, Search, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useProfile } from "@/hooks/useDatabase";
import { useCast } from "@/contexts/CastContext";
import { cn } from "@/lib/utils";
import { CastPairingDialog } from "@/components/cast/CastPairingDialog";

interface MobileHeaderProps {
  onSearchClick?: () => void;
  transparent?: boolean;
  showFilters?: boolean;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All" },
  { id: "series", label: "TV Shows" },
  { id: "movie", label: "Movies" },
];

export function MobileHeader({ 
  onSearchClick, 
  transparent = false,
  showFilters = false,
  activeFilter = "all",
  onFilterChange
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const { currentProfile } = useProfileContext();
  const { data: profile } = useProfile();
  const cast = useCast();
  const [showCastDialog, setShowCastDialog] = useState(false);

  // Use profile avatar from profiles table, fallback to currentProfile
  const avatarUrl = profile?.avatar_url || currentProfile?.avatar_url;
  const displayName = currentProfile?.name || profile?.display_name || "You";

  const handlePair = async (code: string): Promise<boolean> => {
    try {
      const success = await cast.pairWithCode(code);
      return success;
    } catch {
      return false;
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-black">
        {/* Main Header Row */}
        <div className="flex items-center justify-between px-4 h-14">
          {/* Profile Avatar & Name */}
          <button 
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2 active:scale-95 transition-transform"
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={displayName}
                className="w-8 h-8 rounded-lg object-cover ring-2 ring-primary/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">
                  {displayName.charAt(0)}
                </span>
              </div>
            )}
            <span className="text-base font-semibold">
              For {displayName}
            </span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowCastDialog(true)}
              className={cn(
                "p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all",
                cast.isConnected && "text-primary"
              )}
              aria-label="Cast"
            >
              <Cast className="h-5 w-5" />
            </button>
            <button 
              className="p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all"
              aria-label="Notifications"
              onClick={() => navigate("/notification-preferences")}
            >
              <Bell className="h-5 w-5" />
            </button>
            <button 
              onClick={onSearchClick}
              className="p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills Row */}
        {showFilters && (
          <div className="flex items-center gap-2 px-4 pb-3 pt-1 overflow-x-auto hide-scrollbar">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => onFilterChange?.(filter.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300",
                  "border active:scale-95",
                  activeFilter === filter.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground border-border/60 hover:border-foreground/50"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Cast Pairing Dialog */}
      <CastPairingDialog 
        open={showCastDialog} 
        onOpenChange={setShowCastDialog}
        onPair={handlePair}
        isConnecting={cast.isConnecting}
      />
    </>
  );
}
