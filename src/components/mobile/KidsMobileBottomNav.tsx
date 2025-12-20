import { Home, Search, Download, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

interface NavItemProps {
  icon: typeof Home;
  path: string;
  isActive: boolean;
  color: string;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, isActive, color, onClick }: NavItemProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={cn(
        "relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300",
        isActive 
          ? `bg-gradient-to-br ${color} shadow-lg` 
          : "bg-transparent"
      )}
    >
      <Icon 
        className={cn(
          "h-6 w-6 transition-all duration-300",
          isActive 
            ? "text-white stroke-[2.5]" 
            : "text-white/60 stroke-[1.5]"
        )} 
      />
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </motion.button>
  );
};

export const KidsMobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    if (location.pathname.includes("/search")) return "search";
    if (location.pathname.includes("/downloads")) return "downloads";
    if (location.pathname.includes("/my-list")) return "favorites";
    return "home";
  };

  const activeTab = getActiveTab();

  const navItems = [
    { icon: Home, path: "/", key: "home", color: "from-pink-400 to-rose-500" },
    { icon: Search, path: "/search", key: "search", color: "from-purple-400 to-violet-500" },
    { icon: Download, path: "/downloads", key: "downloads", color: "from-cyan-400 to-blue-500" },
    { icon: Heart, path: "/my-list", key: "favorites", color: "from-amber-400 to-orange-500" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe">
      <div className="bg-gradient-to-t from-slate-900/98 via-slate-900/95 to-slate-900/90 backdrop-blur-xl border-t border-white/5 rounded-t-3xl">
        <div className="flex justify-around items-center py-3 max-w-sm mx-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.key}
              icon={item.icon}
              path={item.path}
              isActive={activeTab === item.key}
              color={item.color}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};
