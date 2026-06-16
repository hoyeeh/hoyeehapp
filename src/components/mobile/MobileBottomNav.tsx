import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useHaptics } from "@/hooks/useHaptics";
import { useDownloadManager } from "@/hooks/useDownloadManager";

interface NavItem {
  label: string;
  path: string;
  icon: (active: boolean) => JSX.Element;
}

// Custom smooth outline icons
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill={active ? "currentColor" : "none"}
    stroke="currentColor" 
    strokeWidth={active ? "0" : "1.5"}
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15C14.4477 21 14 20.5523 14 20V15C14 14.4477 13.5523 14 13 14H11C10.4477 14 10 14.4477 10 15V20C10 20.5523 9.55228 21 9 21H4C3.44772 21 3 20.5523 3 20V9.5Z" />
  </svg>
);

const FlameIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill={active ? "currentColor" : "none"}
    stroke="currentColor" 
    strokeWidth={active ? "0" : "1.5"}
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <path d="M8.5 14.5C8.5 16.433 10.067 18 12 18C13.933 18 15.5 16.433 15.5 14.5C15.5 12.5 14 11 12.5 9.5C12 10.5 11 11.5 10.5 12C10 12.5 8.5 12.5 8.5 14.5Z" />
    <path d="M12 2C6.5 6 4 10.5 4 14C4 18.4183 7.58172 22 12 22C16.4183 22 20 18.4183 20 14C20 10.5 17.5 6 12 2Z" />
  </svg>
);

const DownloadIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none"
    stroke="currentColor" 
    strokeWidth="1.5"
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" />
    <path d="M7 10L12 15L17 10" />
    <path d="M12 15V3" strokeWidth={active ? "2.5" : "1.5"} />
  </svg>
);

const UserIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill={active ? "currentColor" : "none"}
    stroke="currentColor" 
    strokeWidth={active ? "0" : "1.5"}
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21" />
  </svg>
);

// Simple outline Search icon
const SearchIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none"
    stroke="currentColor" 
    strokeWidth={active ? "2" : "1.5"}
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21L16.5 16.5" />
  </svg>
);

// Simple outline List icon
const ListIcon = ({ active }: { active: boolean }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none"
    stroke="currentColor" 
    strokeWidth={active ? "2" : "1.5"}
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="transition-all duration-300"
  >
    <path d="M8 6H21" />
    <path d="M8 12H21" />
    <path d="M8 18H21" />
    <circle cx="4" cy="6" r="1" fill={active ? "currentColor" : "none"} />
    <circle cx="4" cy="12" r="1" fill={active ? "currentColor" : "none"} />
    <circle cx="4" cy="18" r="1" fill={active ? "currentColor" : "none"} />
  </svg>
);

const navItems: NavItem[] = [
  { label: "Home", path: "/", icon: (active) => <HomeIcon active={active} /> },
  { label: "Search", path: "/search", icon: (active) => <SearchIcon active={active} /> },
  { label: "My List", path: "/my-list", icon: (active) => <ListIcon active={active} /> },
  { label: "Downloads", path: "/offline-downloads", icon: (active) => <DownloadIcon active={active} /> },
  { label: "My Hoyeeh", path: "/profile", icon: (active) => <UserIcon active={active} /> },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectionTap } = useHaptics();
  const { downloads, getProgress } = useDownloadManager();
  
  // Calculate aggregate download progress
  const activeDownloads = downloads.filter(d => {
    const progress = getProgress(d.id);
    return progress && progress.status === 'downloading';
  });
  
  const hasActiveDownloads = activeDownloads.length > 0;
  const aggregateProgress = hasActiveDownloads
    ? activeDownloads.reduce((sum, d) => {
        const progress = getProgress(d.id);
        return sum + (progress?.progress || 0);
      }, 0) / activeDownloads.length
    : 0;

  const handleNavClick = (path: string) => {
    selectionTap();
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === "/" && location.pathname === "/");
          const isDownloadsTab = item.path === "/offline-downloads";
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all duration-300",
                "active:scale-95 tap-highlight-transparent touch-manipulation",
                isActive 
                  ? "text-primary" 
                  : "text-white/60 hover:text-white/80"
              )}
            >
              <div className={cn(
                "relative p-1 transition-all duration-300",
                isActive && "scale-110"
              )}>
                {item.icon(isActive)}
                
                {/* Download Progress Indicator */}
                {isDownloadsTab && hasActiveDownloads && (
                  <>
                    {/* Circular progress ring */}
                    <svg 
                      className="absolute -inset-0.5 w-7 h-7 -rotate-90"
                      viewBox="0 0 28 28"
                    >
                      <circle
                        cx="14"
                        cy="14"
                        r="12"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="2"
                        opacity="0.3"
                      />
                      <circle
                        cx="14"
                        cy="14"
                        r="12"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${aggregateProgress * 0.754} 75.4`}
                        className="transition-all duration-300"
                      />
                    </svg>
                    
                    {/* Pulsing dot */}
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </>
                )}
                
                {isActive && !isDownloadsTab && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
                {isActive && isDownloadsTab && !hasActiveDownloads && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            </button>
          );
        })}
      </div>
      {/* Extra padding for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-black" />
    </nav>
  );
}
