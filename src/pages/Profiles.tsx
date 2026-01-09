import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { ProfilePicker } from "@/components/ProfilePicker";
import { MobileProfilePicker } from "@/components/mobile/MobileProfilePicker";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const Profiles = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setCurrentProfile, loading: profilesLoading } = useProfileContext();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobileOrTablet = isMobileDevice || isTablet;

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Loading state
  if (authLoading || profilesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const handleProfileSelected = (profile: any) => {
    setCurrentProfile(profile);
    navigate("/", { replace: true });
  };

  // Mobile/Tablet view
  if (isMobileOrTablet) {
    return <MobileProfilePicker onProfileSelected={handleProfileSelected} />;
  }

  // Desktop view
  return <ProfilePicker onProfileSelected={handleProfileSelected} />;
};

export default Profiles;
