import { ReactNode, useMemo } from "react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Home, Search, Heart, LogOut, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { KidsMobileInterface } from "./mobile/KidsMobileInterface";
import { motion, AnimatePresence } from "framer-motion";

interface KidsInterfaceProps {
  children: ReactNode;
}

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.15 },
    },
  }),
};

const tabOrder = ["home", "search", "youtube", "list"] as const;

export const KidsInterface = ({ children }: KidsInterfaceProps) => {
  const { currentProfile, setCurrentProfile } = useProfileContext();
  const navigate = useNavigate();
  const location = useLocation();
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
    if (location.pathname === "/kids-youtube") return "youtube";
    return "home";
  };

  const activeTab = getActiveTab();
  const currentIndex = tabOrder.indexOf(activeTab);
  
  const getPrevIndex = () => {
    const prevPath = sessionStorage.getItem("kids_desktop_prev_tab") || "home";
    return tabOrder.indexOf(prevPath as typeof activeTab);
  };
  
  const direction = currentIndex > getPrevIndex() ? 1 : -1;
  sessionStorage.setItem("kids_desktop_prev_tab", activeTab);

  const handleExit = () => {
    localStorage.removeItem("hoyeeh_current_profile");
    setCurrentProfile(null as any);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/10 via-transparent to-fuchsia-950/10" />
      </div>

      {/* Kids Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between h-full max-w-7xl mx-auto px-6">
          {/* Logo */}
          <button 
            className="flex items-center gap-3 group"
            onClick={() => navigate("/")}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <span className="text-lg font-semibold text-white tracking-[-0.02em]">
              Kids
            </span>
          </button>

          {/* Navigation */}
          <nav className="flex items-center gap-1 bg-white/[0.04] rounded-2xl p-1 border border-white/[0.06]">
            <NavButton 
              icon={Home} 
              label="Home" 
              onClick={() => navigate("/")}
              active={activeTab === "home"}
            />
            <NavButton 
              icon={Search} 
              label="Search" 
              onClick={() => navigate("/search")}
              active={activeTab === "search"}
            />
            <NavButton 
              icon={Youtube} 
              label="Just Kids" 
              onClick={() => navigate("/kids-youtube")}
              active={activeTab === "youtube"}
              isYouTube
            />
            <NavButton 
              icon={Heart} 
              label="Favorites" 
              onClick={() => navigate("/my-list")}
              active={activeTab === "list"}
            />
          </nav>

          {/* Profile & Exit */}
          <div className="flex items-center gap-4">
            {currentProfile?.name && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {currentProfile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-[14px] text-white/70 font-medium">
                  {currentProfile.name}
                </span>
              </div>
            )}
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 hover:text-white text-[13px] font-medium transition-all border border-white/[0.06]"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Exit Kids
            </button>
          </div>
        </div>
      </header>

      {/* Content with padding for header */}
      <main className="pt-20 pb-12 relative z-10 min-h-screen overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

const NavButton = ({ 
  icon: Icon, 
  label, 
  onClick,
  active = false,
  isYouTube = false,
}: { 
  icon: typeof Home; 
  label: string;
  onClick: () => void;
  active?: boolean;
  isYouTube?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
        active 
          ? isYouTube 
            ? "bg-red-500 text-white shadow-lg" 
            : "bg-white text-[#0A0A0F] shadow-lg" 
          : "text-white/60 hover:text-white hover:bg-white/[0.06]"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
};
