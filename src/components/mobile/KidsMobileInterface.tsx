import { ReactNode, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KidsMobileHeader } from "./KidsMobileHeader";
import { KidsMobileBottomNav } from "./KidsMobileBottomNav";
import { KidsMobileHome } from "./KidsMobileHome";
import { KidsMobileSearch } from "./KidsMobileSearch";
import { KidsMobileMyList } from "./KidsMobileMyList";
import { Content } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface KidsMobileInterfaceProps {
  children?: ReactNode;
}

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
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
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  }),
};

const tabOrder = ["home", "search", "favorites"] as const;

export const KidsMobileInterface = ({ children }: KidsMobileInterfaceProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handlePlay = (content: Content) => {
    navigate(`/content/${content.id}?autoplay=true`);
  };

  const handleDetails = (content: Content) => {
    navigate(`/content/${content.id}`);
  };

  const getActiveTab = (): "home" | "search" | "favorites" => {
    if (location.pathname.includes("/search")) return "search";
    if (location.pathname.includes("/my-list")) return "favorites";
    return "home";
  };

  const activeTab = getActiveTab();
  const currentIndex = tabOrder.indexOf(activeTab);
  
  const direction = useMemo(() => {
    const prevPath = sessionStorage.getItem("kids_prev_tab") || "home";
    const prevIndex = tabOrder.indexOf(prevPath as typeof activeTab);
    sessionStorage.setItem("kids_prev_tab", activeTab);
    return currentIndex > prevIndex ? 1 : -1;
  }, [activeTab, currentIndex]);

  const renderContent = () => {
    switch (activeTab) {
      case "search":
        return <KidsMobileSearch onPlay={handlePlay} onDetails={handleDetails} />;
      case "favorites":
        return <KidsMobileMyList onPlay={handlePlay} onDetails={handleDetails} />;
      default:
        return <KidsMobileHome onPlay={handlePlay} onDetails={handleDetails} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] overflow-hidden">
      <KidsMobileHeader />
      
      <main className="relative z-10 pt-[72px] pb-24 min-h-screen overflow-hidden">
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
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      
      <KidsMobileBottomNav />
    </div>
  );
};
