import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

type OnboardingState = 'splash' | 'walkthrough' | 'loading' | 'auth_required' | 'complete';

export const MobileOnboarding = ({ children }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: screens = [], isLoading: screensLoading } = useWalkthroughScreens();
  
  // Check if splash was already shown this session
  const splashSeenThisSession = sessionStorage.getItem(SPLASH_SEEN_KEY) === "true";
  const walkthroughSeen = localStorage.getItem(WALKTHROUGH_SEEN_KEY) === "true";
  
  // Determine initial state
  const [state, setState] = useState<OnboardingState>(() => {
    // If user is logged in, go straight to complete
    if (user) {
      return 'complete';
    }
    
    // If on auth page, don't show splash/walkthrough
    if (location.pathname === '/auth') {
      return 'complete';
    }
    
    // If splash already seen this session
    if (splashSeenThisSession) {
      // If walkthrough already seen, need auth
      if (walkthroughSeen) {
        return 'auth_required';
      }
      // Show walkthrough
      return 'walkthrough';
    }
    
    // First time this session, show splash
    return 'splash';
  });

  // Log state changes for debugging
  useEffect(() => {
    console.log('[MobileOnboarding] State:', state, 'User:', !!user, 'AuthLoading:', authLoading, 'WalkthroughSeen:', walkthroughSeen, 'Path:', location.pathname);
  }, [state, user, authLoading, walkthroughSeen, location.pathname]);

  // Redirect to auth when auth_required state
  useEffect(() => {
    if (state === 'auth_required' && !authLoading) {
      console.log('[MobileOnboarding] Auth required, redirecting to /auth');
      navigate("/auth", { replace: true });
      setState('complete');
    }
  }, [state, authLoading, navigate]);

  // When user logs in, update state
  useEffect(() => {
    if (user && state !== 'complete') {
      console.log('[MobileOnboarding] User logged in, going to complete');
      setState('complete');
    }
  }, [user, state]);

  // Check auth on mount and when returning to app (for persistence)
  useEffect(() => {
    // Skip if still loading auth
    if (authLoading) return;
    
    // Skip if on auth page
    if (location.pathname === '/auth') return;
    
    // If walkthrough has been seen and user is not logged in, redirect to auth
    if (walkthroughSeen && !user && state === 'complete') {
      console.log('[MobileOnboarding] Persistent auth check: not logged in, redirecting');
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, walkthroughSeen, location.pathname, navigate, state]);

  const handleSplashComplete = () => {
    console.log('[MobileOnboarding] Splash complete');
    
    // Mark splash as seen for this session
    sessionStorage.setItem(SPLASH_SEEN_KEY, "true");
    
    // If user is logged in, go to complete
    if (user) {
      console.log('[MobileOnboarding] User logged in, skipping walkthrough');
      setState('complete');
      return;
    }
    
    // If walkthrough already seen, go to auth
    if (walkthroughSeen) {
      console.log('[MobileOnboarding] Walkthrough already seen, going to auth');
      setState('auth_required');
      return;
    }
    
    // Show walkthrough if screens available
    if (!screensLoading && screens.length > 0) {
      console.log('[MobileOnboarding] Showing walkthrough');
      setState('walkthrough');
    } else if (screensLoading) {
      console.log('[MobileOnboarding] Waiting for screens to load');
      setState('loading');
    } else {
      // No screens available, mark as seen and go to auth
      console.log('[MobileOnboarding] No screens, marking as seen and going to auth');
      localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
      setState('auth_required');
    }
  };

  // Handle transition from loading to walkthrough when screens load
  useEffect(() => {
    if (state === 'loading' && !screensLoading) {
      if (screens.length > 0 && !user) {
        console.log('[MobileOnboarding] Screens loaded, showing walkthrough');
        setState('walkthrough');
      } else if (user) {
        console.log('[MobileOnboarding] User logged in during loading');
        setState('complete');
      } else {
        console.log('[MobileOnboarding] No screens, going to auth');
        localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
        setState('auth_required');
      }
    }
  }, [state, screensLoading, screens.length, user]);

  const handleWalkthroughComplete = () => {
    console.log('[MobileOnboarding] Walkthrough complete');
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
    
    // Always redirect to auth after walkthrough (unless already logged in)
    if (!user) {
      setState('auth_required');
    } else {
      setState('complete');
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
      // Fallback - mark as seen and require auth
      localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
      setState('auth_required');
      return null;
    
    case 'auth_required':
      // Show loading while redirecting
      return (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    
    case 'complete':
    default:
      console.log('[MobileOnboarding] Rendering children');
      return <>{children}</>;
  }
};
