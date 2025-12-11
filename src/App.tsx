import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { CastProvider } from "@/contexts/CastContext";
import { migrateLegacyKeys } from "@/utils/cacheManager";
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
import Parental from "./pages/Parental";

const queryClient = new QueryClient();

// Run cache migration once on module load (safe - no React hooks)
migrateLegacyKeys();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CastProvider>
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
                <Route path="/notifications" element={<NotificationPreferences />} />
                <Route path="/notification-preferences" element={<NotificationPreferences />} />
                <Route path="/parental" element={<Parental />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CastProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
