import { Home, Search, Heart, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export const KidsMobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    if (location.pathname.includes("/kids-youtube")) return "youtube";
    if (location.pathname.includes("/search")) return "search";
    if (location.pathname.includes("/my-list")) return "favorites";
    return "home";
  };

  const activeTab = getActiveTab();

  const navItems = [
    { icon: Home, path: "/", key: "home", label: "Home" },
    { icon: Search, path: "/search", key: "search", label: "Search" },
    { icon: Youtube, path: "/kids-youtube", key: "youtube", label: "Just Kids" },
    { icon: Heart, path: "/my-list", key: "favorites", label: "Favorites" },
  ];

  return (
<nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-[#0A0A0F]/95 backdrop-blur-2xl border-t border-white/[0.06]">
        <div className="flex justify-around items-center px-2 py-2">
          {navItems.map(({ key, icon: Icon, path, label }) => {
            const isActive = activeTab === key;
            const isYouTube = key === "youtube";
            
            return (
              <motion.button
                key={key}
                onClick={() => navigate(path)}
                whileTap={{ scale: 0.92 }}
                className="relative flex flex-col items-center gap-1 py-2 px-4 min-w-[64px]"
              >
                <div className="relative">
                  <Icon 
                    className={cn(
                      "h-[22px] w-[22px] transition-colors duration-200",
                      isActive 
                        ? isYouTube ? "text-red-400" : "text-violet-400" 
                        : "text-white/40"
                    )} 
                    strokeWidth={isActive ? 2 : 1.5}
                    fill={isActive && key === "favorites" ? "currentColor" : "none"}
                  />
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className={cn(
                        "absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                        isYouTube ? "bg-red-400" : "bg-violet-400"
                      )}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive 
                    ? isYouTube ? "text-red-400" : "text-violet-400"
                    : "text-white/40"
                )}>
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
      {/* Safe area spacer */}
      <div className="bg-[#0A0A0F] h-safe-area-inset-bottom" />
    </nav>
  );
};