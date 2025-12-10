import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
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
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";
import Genres from "./pages/Genres";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/search" element={<Search />} />
              <Route path="/genres" element={<Genres />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
