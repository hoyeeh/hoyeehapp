import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for cached session ID
const SESSION_STORAGE_KEY = "secure_session_id";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Get cached session ID from localStorage
  const getCachedSessionId = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(SESSION_STORAGE_KEY);
  }, []);

  // Cache session ID in localStorage
  const cacheSessionId = useCallback((sessionId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
  }, []);

  // Clear cached session ID
  const clearCachedSessionId = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // Generate secure session ID via server-side RPC
  const generateSecureSessionId = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc("generate_secure_session_id");
      
      if (error) {
        console.error("Error generating secure session ID:", error);
        return null;
      }
      
      if (data) {
        cacheSessionId(data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error("Error generating secure session ID:", error);
      return null;
    }
  }, [cacheSessionId]);

  // Validate session ID against server
  const validateSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("validate_session", {
        session_id: sessionId,
      });
      
      if (error) {
        console.error("Error validating session:", error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error("Error validating session:", error);
      return false;
    }
  }, []);

  // Check and update session - validates against server
  const checkAndUpdateSession = useCallback(
    async (userId: string) => {
      const cachedSessionId = getCachedSessionId();
      
      try {
        // If we have a cached session, validate it
        if (cachedSessionId) {
          const isValid = await validateSession(cachedSessionId);
          
          if (isValid) {
            // Session is still valid on this device
            return;
          }
          
          // Session is no longer valid - someone else logged in
          // Clear the cache and sign out
          clearCachedSessionId();
          toast.error("Already signed in on another device", {
            description: "You have been signed out because your account is active on another device.",
            duration: 5000,
          });
          await supabase.auth.signOut();
          return;
        }
        
        // No cached session - generate a new one
        await generateSecureSessionId();
      } catch (error) {
        console.error("Error checking session:", error);
      }
    },
    [getCachedSessionId, validateSession, clearCachedSessionId, generateSecureSessionId]
  );

  // Update active session - generates new secure session ID
  const updateActiveSession = useCallback(
    async (userId: string) => {
      try {
        await generateSecureSessionId();
      } catch (error) {
        console.error("Error updating active session:", error);
      }
    },
    [generateSecureSessionId]
  );

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // Handle session on sign in - use setTimeout to avoid deadlock
      if (event === "SIGNED_IN" && currentSession?.user) {
        setTimeout(() => {
          updateActiveSession(currentSession.user.id);
        }, 0);
      }
      
      // Clear cached session on sign out
      if (event === "SIGNED_OUT") {
        clearCachedSessionId();
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);

      // Check active session for existing login
      if (existingSession?.user) {
        setTimeout(() => {
          checkAndUpdateSession(existingSession.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [updateActiveSession, checkAndUpdateSession, clearCachedSessionId]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Use production URL for redirect to ensure proper handling
    const productionUrl = 'https://hoyeeh.com';
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    // Prefer production URL, fallback to current origin for local development
    const redirectUrl = currentOrigin.includes('localhost') 
      ? currentOrigin 
      : productionUrl;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectUrl}/`,
        data: {
          display_name: displayName || email.split("@")[0],
        },
      },
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    // Generate secure server-side session ID
    if (data.user) {
      const cachedSessionId = getCachedSessionId();
      
      // Check if there's an active session on another device
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_session_id")
        .eq("id", data.user.id)
        .single();

      // If there's an active session that doesn't match our cache, inform user
      if (profile?.active_session_id && cachedSessionId && profile.active_session_id !== cachedSessionId) {
        toast.info("Signed out from other device", {
          description: "Your account was active on another device. That session has been ended.",
          duration: 5000,
        });
      }

      // Generate new secure session ID (this also updates the database)
      await generateSecureSessionId();
    }

    return { error: null };
  };

  const signOut = async () => {
    // Clear the active session on sign out via RPC
    if (user) {
      try {
        await supabase.rpc("clear_session");
      } catch (error) {
        console.error("Error clearing session:", error);
      }
    }
    
    // Clear local cache
    clearCachedSessionId();

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
