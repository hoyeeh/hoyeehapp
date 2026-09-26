import { invalidateOfflineOwner } from "@/services/offlineStorage";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_kids: boolean;
  created_at: string;
}

interface ProfileContextType {
  profiles: UserProfile[];
  currentProfile: UserProfile | null;
  loading: boolean;
  setCurrentProfile: (profile: UserProfile | null) => void;
  createProfile: (name: string, isKids: boolean, avatarUrl?: string) => Promise<void>;
  updateProfile: (id: string, data: Partial<UserProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const PROFILE_STORAGE_KEY = "hoyeeh_current_profile";

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = async () => {
    if (!user) {
      setProfiles([]);
      setCurrentProfileState(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      if (error) throw error;

      const typedProfiles = (data || []) as UserProfile[];
      setProfiles(typedProfiles);

      // If no profiles exist, stay on profile picker
      if (typedProfiles.length === 0) {
        setCurrentProfileState(null);
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        invalidateOfflineOwner();
      } else {
        // Try to restore saved profile
        const savedProfileId = localStorage.getItem(PROFILE_STORAGE_KEY);
        const savedProfile = typedProfiles.find(p => p.id === savedProfileId);
        
        if (savedProfile) {
          setCurrentProfileState(savedProfile);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, [user]);

  const setCurrentProfile = (profile: UserProfile | null) => {
    setCurrentProfileState(profile);
    if (profile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, profile.id);
      invalidateOfflineOwner();
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      invalidateOfflineOwner();
    }
  };

  const createProfile = async (name: string, isKids: boolean, avatarUrl?: string) => {
    if (!user) throw new Error("Not authenticated");
    if (profiles.length >= 5) throw new Error("Maximum 5 profiles allowed");

    const { error } = await supabase
      .from("user_profiles")
      .insert({
        user_id: user.id,
        name,
        is_kids: isKids,
        avatar_url: avatarUrl || null,
      });

    if (error) throw error;
    await refreshProfiles();
  };

  const updateProfile = async (id: string, data: Partial<UserProfile>) => {
    const { error } = await supabase
      .from("user_profiles")
      .update(data)
      .eq("id", id);

    if (error) throw error;
    await refreshProfiles();
  };

  const deleteProfile = async (id: string) => {
    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    if (currentProfile?.id === id) {
      setCurrentProfileState(null);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      invalidateOfflineOwner();
    }
    
    await refreshProfiles();
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        currentProfile,
        loading,
        setCurrentProfile,
        createProfile,
        updateProfile,
        deleteProfile,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return context;
};
