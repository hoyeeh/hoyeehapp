import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileParentalControls } from "@/components/mobile/MobileParentalControls";
import { ParentalControls } from "@/components/ParentalControls";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEffect } from "react";

const Parental = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleClose = () => {
    navigate(-1);
  };

  // Loading state - render a simple loader without conditional component branches
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Not authenticated - will redirect via useEffect
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Redirecting..." />
      </div>
    );
  }

  // Mobile version - full screen modal-style component
  if (isMobile) {
    return <MobileParentalControls onClose={handleClose} />;
  }

  // Desktop version
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
          <span className="text-muted-foreground">/ Parental Controls</span>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Parental Controls</h1>
            <p className="text-muted-foreground">
              Manage content restrictions and PIN settings
            </p>
          </div>
        </div>

        {/* Parental Controls Component */}
        <ParentalControls />

        {/* Back Button */}
        <div className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/profile")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Parental;
