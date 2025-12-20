import { ReactNode } from "react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Baby, Home, Search, List, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useKidsSounds } from "@/hooks/useKidsSounds";
import { useIsMobile } from "@/hooks/use-mobile";
import { KidsMobileInterface } from "./mobile/KidsMobileInterface";

interface KidsInterfaceProps {
  children: ReactNode;
}

export const KidsInterface = ({ children }: KidsInterfaceProps) => {
  const { currentProfile, setCurrentProfile } = useProfileContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { playClickSound, playPopSound } = useKidsSounds();
  const isMobile = useIsMobile();

  if (!currentProfile?.is_kids) {
    return <>{children}</>;
  }

  // Use mobile interface on mobile devices
  if (isMobile) {
    return <KidsMobileInterface>{children}</KidsMobileInterface>;
  }

  const getActiveTab = () => {
    if (location.pathname === "/search") return "search";
    if (location.pathname === "/my-list") return "list";
    return "home";
  };

  const activeTab = getActiveTab();

  // Kids mode wrapper with colorful UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-pink-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Stars */}
        {[...Array(20)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute text-yellow-300 animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              fontSize: `${10 + Math.random() * 15}px`,
            }}
          >
            <Sparkles className="h-3 w-3" />
          </div>
        ))}
        
        {/* Floating clouds */}
        {[...Array(5)].map((_, i) => (
          <div
            key={`cloud-${i}`}
            className="absolute text-white/10 animate-float-slow"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 2}s`,
            }}
          >
            <Sparkles className="h-10 w-10" />
          </div>
        ))}
      </div>

      {/* Kids Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-gradient-to-b from-indigo-900/90 via-indigo-900/70 to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              playClickSound();
              navigate("/");
            }}
          >
            <div className="relative">
              <Baby className="h-10 w-10 text-cyan-400 animate-bounce-slow" />
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-twinkle" />
            </div>
            <span className="font-display text-3xl bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-gradient">
              Kids
            </span>
          </div>
          
          <button
            onClick={() => {
              playPopSound();
              localStorage.removeItem("hoyeeh_current_profile");
              setCurrentProfile(null as any);
              navigate("/");
            }}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95 border border-white/20 flex items-center gap-2"
          >
            <Lock className="h-4 w-4" />
            Exit Kids
          </button>
        </div>
      </header>

      {/* Kids Navigation - Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-indigo-900/95 via-indigo-900/80 to-transparent backdrop-blur-md px-4 py-2 safe-area-bottom">
        <div className="flex justify-around max-w-md mx-auto">
          <NavButton 
            icon={Home} 
            label="Home" 
            onClick={() => {
              playClickSound();
              navigate("/");
            }}
            active={activeTab === "home"}
            color="from-pink-500 to-rose-500"
          />
          <NavButton 
            icon={Search} 
            label="Search" 
            onClick={() => {
              playClickSound();
              navigate("/search");
            }}
            active={activeTab === "search"}
            color="from-purple-500 to-violet-500"
          />
          <NavButton 
            icon={List} 
            label="My List" 
            onClick={() => {
              playClickSound();
              navigate("/my-list");
            }}
            active={activeTab === "list"}
            color="from-cyan-500 to-blue-500"
          />
        </div>
      </nav>

      {/* Content with padding for header/nav */}
      <main className="pt-20 pb-24 relative z-10">
        {children}
      </main>
    </div>
  );
};

const NavButton = ({ 
  icon: Icon, 
  label, 
  onClick,
  active = false,
  color,
}: { 
  icon: typeof Home; 
  label: string;
  onClick: () => void;
  active?: boolean;
  color: string;
}) => {
  const { playHoverSound } = useKidsSounds();

  return (
    <button
      onClick={onClick}
      onMouseEnter={playHoverSound}
      className={cn(
        "flex flex-col items-center gap-1 px-6 py-3 rounded-2xl transition-all duration-300 transform",
        active 
          ? `bg-gradient-to-br ${color} text-white scale-110 shadow-lg shadow-purple-500/30` 
          : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
      )}
    >
      <Icon className={cn("h-6 w-6 transition-transform stroke-[1.5]", active && "animate-bounce-slow")} />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
};
