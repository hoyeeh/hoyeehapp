import { Cast, Search, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfileContext } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import logo from "@/assets/hoyeeh-logo-web.png";

interface MobileHeaderProps {
  onSearchClick?: () => void;
  transparent?: boolean;
  showFilters?: boolean;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All" },
  { id: "series", label: "Series" },
  { id: "movie", label: "Films" },
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

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 pt-safe transition-all duration-500",
      transparent 
        ? "bg-gradient-to-b from-background/80 via-background/40 to-transparent" 
        : "bg-background/95 backdrop-blur-xl border-b border-border/30"
    )}>
      {/* Main Header Row */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Profile Avatar & Name */}
        <button 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 active:scale-95 transition-transform"
        >
          {currentProfile?.avatar_url ? (
            <img 
              src={currentProfile.avatar_url} 
              alt={currentProfile.name}
              className="w-8 h-8 rounded-lg object-cover ring-2 ring-primary/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">
                {currentProfile?.name?.charAt(0) || "H"}
              </span>
            </div>
          )}
          <span className="text-base font-semibold">
            For {currentProfile?.name || "You"}
          </span>
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button 
            className="p-2.5 rounded-xl hover:bg-secondary/80 active:scale-95 transition-all"
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
  );
}
