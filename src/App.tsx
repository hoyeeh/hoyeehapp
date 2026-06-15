import { useEffect, useState, Suspense } from "react";
import { lazyWithRetry as lazy } from "@/utils/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
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
import { AppUpdateBanner } from "@/components/AppUpdateBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { EnhancedDownloadQueue } from "@/components/EnhancedDownloadQueue";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { useScheduledDownloadNotifications } from "@/hooks/useScheduledDownloadNotifications";
import { migrateLegacyKeys, initializeCacheManagement } from "@/utils/cacheManager";
import { usePWAUpdates } from "@/hooks/usePWAUpdates";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { PusherNotificationHandler } from "@/components/PusherNotificationHandler";
import { GlobalRightClickGuard } from "@/components/security/GlobalRightClickGuard";
import { GlobalKeyboardGuard } from "@/components/security/GlobalKeyboardGuard";
import { RealtimeUpdatesHandler } from "@/components/RealtimeUpdatesHandler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// Keep landing page eager for fast first paint; lazy-load all other routes
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const Profiles = lazy(() => import("./pages/Profiles"));
const Auth = lazy(() => import("./pages/Auth"));
const PinAuth = lazy(() => import("./pages/PinAuth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Admin = lazy(() => import("./pages/Admin"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const ContentDetail = lazy(() => import("./pages/ContentDetail"));
const MyList = lazy(() => import("./pages/MyList"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Search = lazy(() => import("./pages/Search"));
const Genres = lazy(() => import("./pages/Genres"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const Privacy = lazy(() => import("./pages/Privacy"));
const About = lazy(() => import("./pages/About"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Contact = lazy(() => import("./pages/Contact"));
const Support = lazy(() => import("./pages/Support"));
const Copyright = lazy(() => import("./pages/Copyright"));
const Install = lazy(() => import("./pages/Install"));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Parental = lazy(() => import("./pages/Parental"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const YouTubeChannels = lazy(() => import("./pages/YouTubeChannels"));
const ChannelsPage = lazy(() => import("./pages/ChannelsPage"));
const WatchLater = lazy(() => import("./pages/WatchLater"));
const CreatorStore = lazy(() => import("./pages/CreatorStore"));
const CreatorProfile = lazy(() => import("./pages/CreatorProfile"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const TV = lazy(() => import("./pages/TV"));
const TVReceiver = lazy(() => import("./pages/TVReceiver"));
const TVApp = lazy(() => import("./pages/TVApp"));
const KidsYouTube = lazy(() => import("./pages/KidsYouTube"));
const KidsProfile = lazy(() => import("./pages/KidsProfile"));
const KidsGamesPage = lazy(() => import("./pages/KidsGamesPage"));
const Cast = lazy(() => import("./pages/Cast"));
const WatchParty = lazy(() => import("./pages/WatchParty"));
const MyPurchases = lazy(() => import("./pages/MyPurchases"));
const PurchaseReturn = lazy(() => import("./pages/PurchaseReturn"));
const FreeContent = lazy(() => import("./pages/FreeContent"));
const VideoJsTest = lazy(() => import("./pages/VideoJsTest"));
import { usePendingPurchaseVerification } from "./hooks/usePendingPurchaseVerification";

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
// This handler is "overlay aware" - it checks if video player overlays are open
// and closes them instead of navigating history
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
          // Check if mobile video player overlay is open by looking for the player context
          // The player renders a fixed overlay, so we can detect it via DOM
          const mobilePlayerOverlay = document.querySelector('[data-mobile-video-player]');
          if (mobilePlayerOverlay) {
            // Dispatch a custom event that the player will listen to
            window.dispatchEvent(new CustomEvent('close-mobile-player'));
            return;
          }
          
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
            // Check if mobile video player overlay is open
            const mobilePlayerOverlay = document.querySelector('[data-mobile-video-player]');
            if (mobilePlayerOverlay) {
              window.dispatchEvent(new CustomEvent('close-mobile-player'));
              // Push state back to prevent navigation
              window.history.pushState(null, '', window.location.href);
              return;
            }
            
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

// Background purchase verification handler
function PendingPurchaseVerifier() {
  usePendingPurchaseVerification();
  return null;
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProfileProvider>
          <WatchPartyProvider>
            <MobileVideoPlayerProvider>
              <MobileYouTubePlayerProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
<GlobalRightClickGuard />
                  <GlobalKeyboardGuard />
                  <SubscriptionExpiryChecker />
                  <OfflineIndicator />
                  <AppUpdateBanner />
                  <PWAInstallBanner />
                  <DownloadQueueWrapper />
                  <BrowserRouter>
                    <PWAUpdateHandler />
                    <PWANavigationHandler />
                    <CapacitorBackHandler />
                    <PendingPurchaseVerifier />
                    <RealtimeUpdatesHandler />
                    <CastProvider>
                      <PusherNotificationHandler />
                      <PersistentWatchPartyPanel />
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/profiles" element={<Profiles />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/pin-auth" element={<PinAuth />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/subscription" element={<Subscription />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/profile" element={<ErrorBoundary fallbackTitle="Profile failed to load"><Profile /></ErrorBoundary>} />
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
                        <Route path="/coming-soon" element={<ComingSoon />} />
                        <Route path="/youtube" element={<YouTubeChannels />} />
                        <Route path="/channels" element={<ChannelsPage />} />
                        <Route path="/watch-later" element={<WatchLater />} />
                        <Route path="/watch-party" element={<WatchParty />} />
                        <Route path="/creator-store" element={<CreatorStore />} />
                        <Route path="/creator/:creatorId" element={<CreatorProfile />} />
                        <Route path="/creator-dashboard" element={<CreatorDashboard />} />
                        <Route path="/tv" element={<TV />} />
                        <Route path="/tv-receiver" element={<TVReceiver />} />
                        <Route path="/tv-app" element={<TVApp />} />
                        <Route path="/kids-youtube" element={<KidsYouTube />} />
                        <Route path="/kids-profile" element={<KidsProfile />} />
                        <Route path="/kids-games" element={<KidsGamesPage />} />
                        <Route path="/cast" element={<Cast />} />
                        <Route path="/my-purchases" element={<MyPurchases />} />
                        <Route path="/purchase-return" element={<PurchaseReturn />} />
                        <Route path="/free-content" element={<FreeContent />} />
                        <Route path="/video-js-test" element={<VideoJsTest />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      </Suspense>
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
  </HelmetProvider>
);

export default App;
