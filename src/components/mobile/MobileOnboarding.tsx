import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWalkthroughScreens } from "@/hooks/useWalkthroughScreens";
import { MobileSplashScreen } from "./MobileSplashScreen";
import { MobileWalkthrough } from "./MobileWalkthrough";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const WALKTHROUGH_SEEN_KEY = "hoyeeh_walkthrough_seen";
const SPLASH_SEEN_KEY = "hoyeeh_splash_seen_session";

interface MobileOnboardingProps {
  children: React.ReactNode;
}

type OnboardingState = 'splash' | 'walkthrough' | 'loading' | 'complete';

export const MobileOnboarding = ({ children }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: screens = [], isLoading: screensLoading } = useWalkthroughScreens();
  
  // Check if splash was already shown this session
  const splashSeenThisSession = sessionStorage.getItem(SPLASH_SEEN_KEY) === "true";
  const walkthroughSeen = localStorage.getItem(WALKTHROUGH_SEEN_KEY) === "true";
  
  // Skip splash if already seen this session OR if user is logged in
  const [state, setState] = useState<OnboardingState>(() => {
    if (splashSeenThisSession || user) {
      return 'complete';
    }
    return 'splash';
  });

  useEffect(() => {
    console.log('[MobileOnboarding] State:', state, 'User:', !!user, 'AuthLoading:', authLoading, 'WalkthroughSeen:', walkthroughSeen);
  }, [state, user, authLoading, walkthroughSeen]);

  const handleSplashComplete = () => {
    console.log('[MobileOnboarding] Splash complete');
    
    // Mark splash as seen for this session
    sessionStorage.setItem(SPLASH_SEEN_KEY, "true");
    
    // If user is logged in or walkthrough already seen, go to complete
    if (user || walkthroughSeen) {
      console.log('[MobileOnboarding] Skipping walkthrough, going to complete');
      setState('complete');
    } else if (!screensLoading && screens.length > 0) {
      console.log('[MobileOnboarding] Showing walkthrough');
      setState('walkthrough');
    } else if (screensLoading) {
      console.log('[MobileOnboarding] Waiting for screens to load');
      setState('loading');
    } else {
      // No screens available, skip walkthrough
      console.log('[MobileOnboarding] No screens, going to complete');
      setState('complete');
    }
  };

  // Handle transition from loading to walkthrough when screens load
  useEffect(() => {
    if (state === 'loading' && !screensLoading) {
      if (screens.length > 0 && !user && !walkthroughSeen) {
        console.log('[MobileOnboarding] Screens loaded, showing walkthrough');
        setState('walkthrough');
      } else {
        console.log('[MobileOnboarding] Screens loaded, going to complete');
        setState('complete');
      }
    }
  }, [state, screensLoading, screens.length, user, walkthroughSeen]);

  const handleWalkthroughComplete = () => {
    console.log('[MobileOnboarding] Walkthrough complete');
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
    setState('complete');
    
    // Redirect to auth page after walkthrough
    if (!user && !authLoading) {
      navigate("/auth");
    }
  };

  // Render based on state
  switch (state) {
    case 'splash':
      return <MobileSplashScreen onComplete={handleSplashComplete} />;
    
    case 'loading':
      return (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    
    case 'walkthrough':
      if (screens.length > 0) {
        return (
          <MobileWalkthrough 
            screens={screens} 
            onComplete={handleWalkthroughComplete} 
          />
        );
      }
      // Fallback to complete if no screens
      setState('complete');
      return null;
    
    case 'complete':
    default:
      console.log('[MobileOnboarding] Rendering children');
      return <>{children}</>;
  }
};
