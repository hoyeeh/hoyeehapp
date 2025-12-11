import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

// Generate a unique session ID for this browser instance
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Get or create session ID for this browser
const getLocalSessionId = () => {
  let sessionId = localStorage.getItem('device_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem('device_session_id', sessionId);
  }
  return sessionId;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle session on sign in - use setTimeout to avoid deadlock
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            updateActiveSession(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Check active session for existing login
      if (session?.user) {
        setTimeout(() => {
          checkAndUpdateSession(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateActiveSession = async (userId: string) => {
    const localSessionId = getLocalSessionId();
    
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
  };

  const checkAndUpdateSession = async (userId: string) => {
    const localSessionId = getLocalSessionId();
    
    try {
      // Check if there's an active session
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('id', userId)
        .single();

      if (profile?.active_session_id && profile.active_session_id !== localSessionId) {
        // Another device is logged in, sign out this one
        toast.error("Already signed in on another device", {
          description: "You have been signed out because your account is active on another device.",
          duration: 5000,
        });
        await supabase.auth.signOut();
        return;
      }

      // Update this session as active
      await updateActiveSession(userId);
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
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
        // Force logout the other device by updating the session
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
