import { useState } from "react";
import { Cast, Search, Bell, Grid3X3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useProfile } from "@/hooks/useDatabase";
import { useCast } from "@/contexts/CastContext";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { MobileCastSheet } from "./MobileCastSheet";
import { MobileNotificationSheet } from "./MobileNotificationSheet";
import { MobileCategoriesSheet } from "./MobileCategoriesSheet";

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
  { id: "categories", label: "Categories", isSpecial: true },
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
  const { data: unreadCount } = useUnreadNotificationCount();
  const [showCastSheet, setShowCastSheet] = useState(false);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false);

  // Use profile avatar from profiles table, fallback to currentProfile
  const avatarUrl = profile?.avatar_url || currentProfile?.avatar_url;
  const displayName = currentProfile?.name || profile?.display_name || "You";

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
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setShowCastSheet(true)}
              className={cn(
                "relative p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation",
                cast.isConnected && "text-primary"
              )}
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Cast to device"
            >
              <Cast className="h-5 w-5" />
              {cast.isConnected && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
              )}
            </button>
            <button 
              className="relative p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Notifications"
              onClick={() => setShowNotificationSheet(true)}
            >
              <Bell className="h-5 w-5" />
              {typeof unreadCount === 'number' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={onSearchClick}
              className="p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills Row */}
        {showFilters && (
          <div className="flex items-center gap-1.5 px-3 pb-3 pt-1 overflow-x-auto hide-scrollbar">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  if ((filter as any).isSpecial) {
                    setShowCategoriesSheet(true);
                  } else {
                    onFilterChange?.(filter.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300",
                  "border active:scale-95 touch-manipulation",
                  (filter as any).isSpecial
                    ? "bg-primary/10 text-primary border-primary/30"
                    : activeFilter === filter.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground border-border/60 hover:border-foreground/50"
                )}
              >
                {(filter as any).isSpecial && <Grid3X3 className="h-3 w-3" />}
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Full Cast Sheet with all casting options */}
      <MobileCastSheet 
        open={showCastSheet} 
        onClose={() => setShowCastSheet(false)}
      />

      {/* Notification Sheet */}
      <MobileNotificationSheet
        open={showNotificationSheet}
        onClose={() => setShowNotificationSheet(false)}
      />

      {/* Categories Sheet */}
      <MobileCategoriesSheet
        open={showCategoriesSheet}
        onClose={() => setShowCategoriesSheet(false)}
      />
    </>
  );
}
