import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWalkthroughScreens } from "@/hooks/useWalkthroughScreens";
import { MobileSplashScreen } from "./MobileSplashScreen";
import { MobileWalkthrough } from "./MobileWalkthrough";

const WALKTHROUGH_SEEN_KEY = "hoyeeh_walkthrough_seen";

interface MobileOnboardingProps {
  children: React.ReactNode;
}

export const MobileOnboarding = ({ children }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: screens = [], isLoading: screensLoading } = useWalkthroughScreens();
  
  const [showSplash, setShowSplash] = useState(true);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check if walkthrough has been seen before
  const walkthroughSeen = localStorage.getItem(WALKTHROUGH_SEEN_KEY) === "true";

  useEffect(() => {
    // If walkthrough already seen, skip it
    if (walkthroughSeen) {
      setShowWalkthrough(false);
    }
  }, [walkthroughSeen]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    
    // If user is logged in or walkthrough already seen, skip walkthrough
    if (user || walkthroughSeen) {
      setOnboardingComplete(true);
    } else {
      setShowWalkthrough(true);
    }
  };

  const handleWalkthroughComplete = () => {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
    setShowWalkthrough(false);
    setOnboardingComplete(true);
    
    // Redirect to auth page after walkthrough
    if (!user && !authLoading) {
      navigate("/auth");
    }
  };

  // Show splash screen
  if (showSplash) {
    return <MobileSplashScreen onComplete={handleSplashComplete} />;
  }

  // Show walkthrough screens (only if not seen before and not logged in)
  if (showWalkthrough && !screensLoading && screens.length > 0) {
    return (
      <MobileWalkthrough 
        screens={screens} 
        onComplete={handleWalkthroughComplete} 
      />
    );
  }

  // After walkthrough, if not logged in, redirect to auth
  if (onboardingComplete && !user && !authLoading) {
    // Let the auth redirect happen naturally
  }

  return <>{children}</>;
};
