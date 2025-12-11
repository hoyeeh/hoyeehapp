import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate a unique session ID for this browser instance - inside component to avoid SSR issues
  const generateSessionId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Get or create session ID for this browser - inside component to avoid SSR issues
  const getLocalSessionId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    
    let sessionId = localStorage.getItem('device_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem('device_session_id', sessionId);
    }
    return sessionId;
  }, [generateSessionId]);

  const updateActiveSession = useCallback(async (userId: string) => {
    const localSessionId = getLocalSessionId();
    if (!localSessionId) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          active_session_id: localSessionId,
          last_login_at: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating active session:', error);
    }
  }, [getLocalSessionId]);

  const checkAndUpdateSession = useCallback(async (userId: string) => {
    const localSessionId = getLocalSessionId();
    if (!localSessionId) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', userId)
        .single();

      if (profile?.active_session_id && profile.active_session_id !== localSessionId) {
        toast.error("Already signed in on another device", {
          description: "You have been signed out because your account is active on another device.",
          duration: 5000,
        });
        await supabase.auth.signOut();
        return;
      }

      await updateActiveSession(userId);
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }, [getLocalSessionId, updateActiveSession]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        
        // Handle session on sign in - use setTimeout to avoid deadlock
        if (event === 'SIGNED_IN' && currentSession?.user) {
          setTimeout(() => {
            updateActiveSession(currentSession.user.id);
          }, 0);
        }
      }
    );

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
  }, [updateActiveSession, checkAndUpdateSession]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName || email.split('@')[0],
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

    // Check if another device is already logged in
    if (data.user) {
      const localSessionId = getLocalSessionId();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', data.user.id)
        .single();

      if (profile?.active_session_id && profile.active_session_id !== localSessionId) {
        toast.info("Signed out from other device", {
          description: "Your account was active on another device. That session has been ended.",
          duration: 5000,
        });
      }

      // Update session for this device
      await supabase
        .from('profiles')
        .update({ 
          active_session_id: localSessionId,
          last_login_at: new Date().toISOString()
        })
        .eq('id', data.user.id);
    }
    
    return { error: null };
  };

  const signOut = async () => {
    // Clear the active session on sign out
    if (user) {
      await supabase
        .from('profiles')
        .update({ active_session_id: null })
        .eq('id', user.id);
    }
    
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
