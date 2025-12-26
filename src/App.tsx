import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { CastProvider } from "@/contexts/CastContext";
import { MobileVideoPlayerProvider } from "@/contexts/MobileVideoPlayerContext";
import { MobileYouTubePlayerProvider } from "@/contexts/MobileYouTubePlayerContext";
import { WatchPartyProvider } from "@/contexts/WatchPartyContext";
import { PersistentMobileVideoPlayer } from "@/components/mobile/PersistentMobileVideoPlayer";
import { PersistentMobileYouTubePlayer } from "@/components/mobile/PersistentMobileYouTubePlayer";
import { PersistentWatchPartyPanel } from "@/components/PersistentWatchPartyPanel";
import { SubscriptionExpiryChecker } from "@/components/SubscriptionExpiryChecker";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { EnhancedDownloadQueue } from "@/components/EnhancedDownloadQueue";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { useScheduledDownloadNotifications } from "@/hooks/useScheduledDownloadNotifications";
import { migrateLegacyKeys, initializeCacheManagement } from "@/utils/cacheManager";
import { usePWAUpdates } from "@/hooks/usePWAUpdates";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { PusherNotificationHandler } from "@/components/PusherNotificationHandler";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PinAuth from "./pages/PinAuth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Subscription from "./pages/Subscription";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import ContentDetail from "./pages/ContentDetail";
import MyList from "./pages/MyList";
import Downloads from "./pages/Downloads";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";
import Genres from "./pages/Genres";
import TermsOfUse from "./pages/TermsOfUse";
import Privacy from "./pages/Privacy";
import About from "./pages/About";
import HelpCenter from "./pages/HelpCenter";
import Contact from "./pages/Contact";
import Support from "./pages/Support";
import Copyright from "./pages/Copyright";
import Install from "./pages/Install";
import NotificationPreferences from "./pages/NotificationPreferences";
import Notifications from "./pages/Notifications";
import Parental from "./pages/Parental";
import ComingSoon from "./pages/ComingSoon";
import YouTubeChannels from "./pages/YouTubeChannels";
import WatchLater from "./pages/WatchLater";
import CreatorStore from "./pages/CreatorStore";
import CreatorDashboard from "./pages/CreatorDashboard";
import TV from "./pages/TV";
import TVReceiver from "./pages/TVReceiver";
import TVApp from "./pages/TVApp";
import KidsYouTube from "./pages/KidsYouTube";
import Cast from "./pages/Cast";

const queryClient = new QueryClient();

// Run cache management immediately (safe - no React hooks, pure localStorage operation)
if (typeof window !== 'undefined') {
  migrateLegacyKeys();
  // Initialize cache management asynchronously
  initializeCacheManagement().catch(console.error);
}

// PWA Update Handler - auto-updates the app when new version is available
function PWAUpdateHandler() {
  usePWAUpdates();
  return null;
}

// PWA Navigation Handler - manages back button and navigation within PWA
function PWANavigationHandler() {
  usePWANavigation();
  return null;
}

// Global back button handler for Capacitor native apps and PWA
function CapacitorBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Check if running as standalone PWA
    const isStandalonePWA = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const setupBackHandler = async () => {
      try {
        const { App } = await import('@capacitor/app');
        
        const listener = App.addListener('backButton', ({ canGoBack }) => {
          // If on home page, minimize app
          if (location.pathname === '/') {
            App.minimizeApp?.() || App.exitApp();
          } else if (canGoBack && window.history.length > 1) {
            window.history.back();
          } else {
            // Navigate to home as fallback
            navigate('/', { replace: true });
          }
        });

        cleanup = () => {
          listener.then(l => l.remove());
        };
      } catch (e) {
        // Capacitor not available - handle PWA back navigation
        if (isStandalonePWA) {
          const handlePopState = () => {
            // If trying to exit the app (no more history), go to home
            if (window.history.length <= 1 && location.pathname !== '/') {
              navigate('/', { replace: true });
            }
          };
          
          window.addEventListener('popstate', handlePopState);
          cleanup = () => window.removeEventListener('popstate', handlePopState);
        }
      }
    };

    setupBackHandler();

    return () => {
      cleanup?.();
    };
  }, [navigate, location.pathname]);

  return null;
}

// Download Queue Wrapper Component
function DownloadQueueWrapper() {
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { downloads } = useDownloadManager();
  const { requestPermission } = useScheduledDownloadNotifications();
  
  // Request notification permission on first download
  useEffect(() => {
    if (downloads.length > 0) {
      requestPermission();
    }
  }, [downloads.length, requestPermission]);
  
  // Auto-show when downloads are active
  const hasActiveDownloads = downloads.some(d => 
    ['downloading', 'paused', 'pending', 'queued'].includes(d.status)
  );
  
  useEffect(() => {
    if (hasActiveDownloads && !isQueueOpen) {
      setIsQueueOpen(true);
    }
  }, [hasActiveDownloads]);

  return (
    <EnhancedDownloadQueue 
      isOpen={isQueueOpen || hasActiveDownloads} 
      onClose={() => setIsQueueOpen(false)} 
    />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ProfileProvider>
        <WatchPartyProvider>
          <MobileVideoPlayerProvider>
            <MobileYouTubePlayerProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <SubscriptionExpiryChecker />
                <OfflineIndicator />
                <PWAInstallBanner />
                <DownloadQueueWrapper />
                <BrowserRouter>
                  <PWAUpdateHandler />
                  <PWANavigationHandler />
                  <CapacitorBackHandler />
                  <CastProvider>
                    <PusherNotificationHandler />
                    <PersistentWatchPartyPanel />
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/pin-auth" element={<PinAuth />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/subscription" element={<Subscription />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/content/:id" element={<ContentDetail />} />
                      <Route path="/my-list" element={<MyList />} />
                      <Route path="/downloads" element={<Downloads />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/genres" element={<Genres />} />
                      <Route path="/terms" element={<TermsOfUse />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/help" element={<HelpCenter />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/copyright" element={<Copyright />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/notification-preferences" element={<NotificationPreferences />} />
                      <Route path="/parental" element={<Parental />} />
                      <Route path="/parental" element={<Parental />} />
                      <Route path="/coming-soon" element={<ComingSoon />} />
                      <Route path="/youtube" element={<YouTubeChannels />} />
                      <Route path="/watch-later" element={<WatchLater />} />
                      <Route path="/creator-store" element={<CreatorStore />} />
                      <Route path="/creator-dashboard" element={<CreatorDashboard />} />
                      <Route path="/tv" element={<TV />} />
                      <Route path="/tv-receiver" element={<TVReceiver />} />
                      <Route path="/tv-app" element={<TVApp />} />
                      <Route path="/kids-youtube" element={<KidsYouTube />} />
                      <Route path="/cast" element={<Cast />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <PersistentMobileVideoPlayer />
                    <PersistentMobileYouTubePlayer />
                  </CastProvider>
                </BrowserRouter>
              </TooltipProvider>
            </MobileYouTubePlayerProvider>
          </MobileVideoPlayerProvider>
        </WatchPartyProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
