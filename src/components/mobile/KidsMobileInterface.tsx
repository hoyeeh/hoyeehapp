import { ReactNode, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KidsMobileHeader } from "./KidsMobileHeader";
import { KidsMobileBottomNav } from "./KidsMobileBottomNav";
import { KidsMobileHome } from "./KidsMobileHome";
import { KidsMobileSearch } from "./KidsMobileSearch";
import { KidsMobileMyList } from "./KidsMobileMyList";
import { Content } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { MobileSwipeWrapper } from "./MobileSwipeWrapper";

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

const tabOrder = ["home", "search", "youtube", "favorites"] as const;

export const KidsMobileInterface = ({ children }: KidsMobileInterfaceProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const mobilePlayer = useMobileVideoPlayer();
  const { currentProfile } = useProfileContext();

  const handlePlay = (content: Content) => {
    // For movies with video URL, use mobile player directly with kids mode
    if (content.contentType === "movie" && content.videoUrl) {
      mobilePlayer.openPlayer({
        content,
        videoUrl: content.videoUrl,
        title: content.title,
        thumbnail: content.thumbnailUrl,
        isKidsMode: true,
        kidsProfileId: currentProfile?.id,
      });
    } else if (content.contentType === "series") {
      // For series, navigate to details to select episode
      navigate(`/content/${content.id}?autoplay=true`);
    } else {
      toast.error("No video available");
    }
  };

  const handleDetails = (content: Content) => {
    navigate(`/content/${content.id}`);
  };

  const getActiveTab = (): "home" | "search" | "youtube" | "favorites" => {
    if (location.pathname.includes("/kids-youtube")) return "youtube";
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
      case "youtube":
        // Pass through children for YouTube page - it renders its own content
        return children;
      default:
        return <KidsMobileHome onPlay={handlePlay} onDetails={handleDetails} />;
    }
  };

  return (
    <MobileSwipeWrapper>
      <div className="min-h-screen bg-[#0A0A0F] overflow-hidden">
        <KidsMobileHeader />
        
        <main className="relative z-10 min-h-screen overflow-hidden" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top, 20px))', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
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
    </MobileSwipeWrapper>
  );
};
