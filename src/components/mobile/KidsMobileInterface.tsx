import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KidsMobileHeader } from "./KidsMobileHeader";
import { KidsMobileBottomNav } from "./KidsMobileBottomNav";
import { KidsMobileHome } from "./KidsMobileHome";
import { KidsMobileSearch } from "./KidsMobileSearch";
import { KidsMobileMyList } from "./KidsMobileMyList";
import { Content } from "@/types";
import { motion } from "framer-motion";

interface KidsMobileInterfaceProps {
  children?: ReactNode;
}

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

  const handleTabChange = (tab: "home" | "search" | "favorites") => {
    if (tab === "home") navigate("/");
    else if (tab === "search") navigate("/search");
    else if (tab === "favorites") navigate("/my-list");
  };

  const renderContent = () => {
    if (location.pathname.includes("/search")) {
      return <KidsMobileSearch onPlay={handlePlay} onDetails={handleDetails} />;
    }
    if (location.pathname.includes("/my-list")) {
      return <KidsMobileMyList onPlay={handlePlay} onDetails={handleDetails} />;
    }
    return <KidsMobileHome onPlay={handlePlay} onDetails={handleDetails} />;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <KidsMobileHeader />
      
      <motion.main 
        className="relative z-10 pt-[72px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.main>
      
      <KidsMobileBottomNav />
    </div>
  );
};