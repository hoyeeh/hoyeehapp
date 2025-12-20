import { ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KidsMobileHeader } from "./KidsMobileHeader";
import { KidsMobileBottomNav } from "./KidsMobileBottomNav";
import { KidsMobileHome } from "./KidsMobileHome";
import { KidsMobileSearch } from "./KidsMobileSearch";
import { KidsMobileMyList } from "./KidsMobileMyList";
import { KidsMobileDownloads } from "./KidsMobileDownloads";
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

  const renderContent = () => {
    if (location.pathname.includes("/search")) {
      return <KidsMobileSearch onPlay={handlePlay} onDetails={handleDetails} />;
    }
    if (location.pathname.includes("/downloads")) {
      return <KidsMobileDownloads onPlay={handlePlay} />;
    }
    if (location.pathname.includes("/my-list")) {
      return <KidsMobileMyList onPlay={handlePlay} onDetails={handleDetails} />;
    }
    return <KidsMobileHome onPlay={handlePlay} onDetails={handleDetails} />;
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/30 pointer-events-none" />
      
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

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