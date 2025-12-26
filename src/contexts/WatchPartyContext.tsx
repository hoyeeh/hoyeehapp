import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface WatchParty {
  id: string;
  host_user_id: string;
  content_id: string;
  episode_id: string | null;
  party_code: string;
  is_active: boolean;
  playback_time: number;
  is_playing: boolean;
  created_at: string;
}

interface PartyMember {
  id: string;
  party_id: string;
  user_id: string;
  joined_at: string;
  is_ready: boolean;
  display_name?: string;
  avatar_url?: string;
}

interface PartyReaction {
  id: string;
  user_id: string;
  user_name: string;
  emoji: string;
  timestamp: number;
}

interface PartyMessage {
  id: string;
  party_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name?: string;
}

interface WatchPartyContextType {
  party: WatchParty | null;
  members: PartyMember[];
  messages: PartyMessage[];
  reactions: PartyReaction[];
  isHost: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  isWatchPartyGuest: boolean;
  createParty: (contentId: string, episodeId?: string) => Promise<WatchParty | null>;
  joinParty: (code: string) => Promise<WatchParty | null>;
  leaveParty: () => Promise<void>;
  updatePlayback: (time: number, playing: boolean) => void;
  setReady: (ready: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendReaction: (emoji: string) => void;
  startWatchingTogether: () => Promise<void>;
  syncToParty: (videoElement: HTMLVideoElement | null, forceSync?: boolean) => void;
}

const WatchPartyContext = createContext<WatchPartyContextType | null>(null);

// Throttle helper
function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}

export function WatchPartyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [party, setParty] = useState<WatchParty | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [messages, setMessages] = useState<PartyMessage[]>([]);
  const [reactions, setReactions] = useState<PartyReaction[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncTimeRef = useRef<number>(0);
  const initialSyncDoneRef = useRef<boolean>(false);
  const reactionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Computed: is user a guest in a watch party (non-host)
  const isWatchPartyGuest = Boolean(party && !isHost);

  // Generate unique party code
  const generateCode = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_party_code');
    if (error) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }
    return data as string;
  }, []);

  // Create a new watch party
  const createParty = useCallback(async (contentId: string, episodeId?: string) => {
    if (!user) {
      toast.error("Please sign in to create a watch party");
      return null;
    }

    setIsLoading(true);
    try {
      const code = await generateCode();
      
      const { data, error } = await supabase
        .from('watch_parties')
        .insert({
          host_user_id: user.id,
          content_id: contentId,
          episode_id: episodeId || null,
          party_code: code,
          is_active: true,
          playback_time: 0,
          is_playing: false
        })
        .select()
        .single();

      if (error) throw error;

      // Host automatically joins
      await supabase
        .from('watch_party_members')
        .insert({
          party_id: data.id,
          user_id: user.id,
          is_ready: true
        });

      setParty(data);
      setIsHost(true);
      setMessages([]);
      toast.success(`Watch party created! Code: ${code}`);
      return data;
    } catch (error: any) {
      console.error("Failed to create watch party:", error);
      toast.error("Failed to create watch party");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, generateCode]);

  // Join an existing party using secure backend function
  const joinParty = useCallback(async (code: string) => {
    if (!user) {
      toast.error("Please sign in to join a watch party");
      return null;
    }

    setIsLoading(true);
    try {
      // Use the secure RPC function to join the party
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('join_watch_party_by_code', { party_code: code.toUpperCase() });

      if (rpcError) {
        console.error("RPC error joining party:", rpcError);
        if (rpcError.message?.includes('not found') || rpcError.message?.includes('no longer active')) {
          toast.error("Party not found or has ended");
        } else if (rpcError.message?.includes('authenticated')) {
          toast.error("Please sign in to join a watch party");
        } else {
          toast.error("Failed to join watch party");
        }
        return null;
      }

      // The RPC returns an array, get the first row
      const partyResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      
      if (!partyResult) {
        toast.error("Party not found or has ended");
        return null;
      }

      // Map the RPC result to the WatchParty interface
      const partyData: WatchParty = {
        id: partyResult.party_id,
        content_id: partyResult.content_id,
        episode_id: partyResult.episode_id,
        host_user_id: partyResult.host_user_id,
        playback_time: partyResult.playback_time ?? 0,
        is_playing: partyResult.is_playing ?? false,
        party_code: partyResult.party_code_out,
        is_active: true,
        created_at: new Date().toISOString()
      };

      setParty(partyData);
      setIsHost(partyData.host_user_id === user.id);
      setMessages([]);
      toast.success("Joined watch party!");
      return partyData;
    } catch (error: any) {
      console.error("Failed to join watch party:", error);
      toast.error("Failed to join watch party");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Leave the party
  const leaveParty = useCallback(async () => {
    if (!party || !user) return;

    try {
      if (isHost) {
        await supabase
          .from('watch_parties')
          .update({ is_active: false })
          .eq('id', party.id);
      } else {
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('party_id', party.id)
          .eq('user_id', user.id);
      }

      setParty(null);
      setMembers([]);
      setMessages([]);
      setIsHost(false);
      toast.info(isHost ? "Watch party ended" : "Left watch party");
    } catch (error) {
      console.error("Failed to leave party:", error);
    }
  }, [party, user, isHost]);

  // Throttled playback update (host only)
  const updatePlayback = useCallback(
    throttle(async (time: number, playing: boolean) => {
      if (!party || !isHost) return;

      try {
        await supabase
          .from('watch_parties')
          .update({ 
            playback_time: time, 
            is_playing: playing,
            updated_at: new Date().toISOString()
          })
          .eq('id', party.id);
      } catch (error) {
        console.error("Failed to update playback:", error);
      }
    }, 1000), // Max 1 update per second
    [party, isHost]
  );

  // Set ready status
  const setReady = useCallback(async (ready: boolean) => {
    if (!party || !user) return;

    try {
      await supabase
        .from('watch_party_members')
        .update({ is_ready: ready })
        .eq('party_id', party.id)
        .eq('user_id', user.id);
    } catch (error) {
      console.error("Failed to update ready status:", error);
    }
  }, [party, user]);

  // Send a chat message
  const sendMessage = useCallback(async (text: string) => {
    if (!party || !user || !text.trim()) return;

    try {
      const { error } = await supabase
        .from('watch_party_messages')
        .insert({
          party_id: party.id,
          user_id: user.id,
          message: text.trim()
        });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  }, [party, user]);

  // Sync video to party state (for non-hosts)
  // forceSync=true bypasses the threshold check (used for initial sync on join)
  const syncToParty = useCallback((videoElement: HTMLVideoElement | null, forceSync: boolean = false) => {
    if (!videoElement || !party || isHost) return;

    const partyTime = Number(party.playback_time);
    const timeDiff = Math.abs(videoElement.currentTime - partyTime);
    
    // Tighter sync threshold: 0.5 seconds for better synchronization
    // Force sync on initial join (bypasses threshold)
    const shouldSync = forceSync || timeDiff > 0.5;
    
    if (shouldSync && timeDiff > 0.1) {
      setIsSyncing(true);
      videoElement.currentTime = partyTime;
      // Clear syncing state after a brief delay
      setTimeout(() => setIsSyncing(false), 500);
    }
    
    // Sync play/pause state
    if (party.is_playing && videoElement.paused) {
      videoElement.play().catch(() => {});
    } else if (!party.is_playing && !videoElement.paused) {
      videoElement.pause();
    }
    
    // Mark initial sync as done
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
    }
  }, [party, isHost]);

  // Send a reaction (broadcast to all party members)
  const sendReaction = useCallback((emoji: string) => {
    if (!party || !user || !reactionChannelRef.current) return;

    const reaction: PartyReaction = {
      id: crypto.randomUUID(),
      user_id: user.id,
      user_name: members.find(m => m.user_id === user.id)?.display_name || 'Guest',
      emoji,
      timestamp: Date.now()
    };

    reactionChannelRef.current.send({
      type: 'broadcast',
      event: 'reaction',
      payload: reaction
    });

    // Also add to local state
    setReactions(prev => [...prev, reaction]);
    
    // Remove reaction after 3 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reaction.id));
    }, 3000);
  }, [party, user, members]);

  // Start watching together (host only) - resets everyone to start and begins playback
  const startWatchingTogether = useCallback(async () => {
    if (!party || !isHost) return;

    try {
      // Reset playback to beginning and start playing
      await supabase
        .from('watch_parties')
        .update({ 
          playback_time: 0, 
          is_playing: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', party.id);

      toast.success("Starting playback for everyone!");
    } catch (error) {
      console.error("Failed to start watching together:", error);
      toast.error("Failed to start playback");
    }
  }, [party, isHost]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!party) return;

    // Subscribe to party updates
    const partyChannel = supabase
      .channel(`watch-party-${party.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watch_parties',
          filter: `id=eq.${party.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as WatchParty;
            setParty(updated);
            
            if (!updated.is_active) {
              toast.info("Watch party has ended");
              setParty(null);
              setMembers([]);
              setMessages([]);
              setReactions([]);
              setIsHost(false);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watch_party_members',
          filter: `party_id=eq.${party.id}`
        },
        async () => {
          // Fetch members with profile display names
          const { data } = await supabase
            .from('watch_party_members')
            .select('*')
            .eq('party_id', party.id);
          
          if (data) {
            const userIds = data.map(m => m.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .in('id', userIds);

            const profileMap = new Map(profiles?.map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]) || []);
            
            setMembers(data.map(m => ({
              ...m,
              display_name: profileMap.get(m.user_id)?.display_name || undefined,
              avatar_url: profileMap.get(m.user_id)?.avatar_url || undefined
            })));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'watch_party_messages',
          filter: `party_id=eq.${party.id}`
        },
        async (payload) => {
          const newMsg = payload.new as PartyMessage;
          
          // Fetch user display name
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', newMsg.user_id)
            .single();
          
          setMessages(prev => [...prev, {
            ...newMsg,
            user_name: profile?.display_name || 'Guest'
          }]);
        }
      )
      .subscribe();

    // Reaction channel for broadcast
    const reactionChannel = supabase
      .channel(`watch-party-reactions-${party.id}`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
        const reaction = payload.payload as PartyReaction;
        // Don't add our own reactions (already added locally)
        if (reaction.user_id === user?.id) return;
        
        setReactions(prev => [...prev, reaction]);
        
        // Remove reaction after 3 seconds
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 3000);
      })
      .subscribe();

    reactionChannelRef.current = reactionChannel;

    // Fetch initial members with display names
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('watch_party_members')
        .select('*')
        .eq('party_id', party.id);
      
      if (data) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]) || []);
        
        setMembers(data.map(m => ({
          ...m,
          display_name: profileMap.get(m.user_id)?.display_name || undefined,
          avatar_url: profileMap.get(m.user_id)?.avatar_url || undefined
        })));
      }
    };
    fetchMembers();

    // Fetch initial messages with user names
    const fetchMessages = async () => {
      const { data: msgs } = await supabase
        .from('watch_party_messages')
        .select('*')
        .eq('party_id', party.id)
        .order('created_at', { ascending: true });

      if (msgs && msgs.length > 0) {
        const userIds = [...new Set(msgs.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);
        
        setMessages(msgs.map(m => ({
          ...m,
          user_name: profileMap.get(m.user_id) || 'Guest'
        })));
      }
    };
    fetchMessages();

    return () => {
      supabase.removeChannel(partyChannel);
      supabase.removeChannel(reactionChannel);
      reactionChannelRef.current = null;
    };
  }, [party?.id, user?.id]);

  return (
    <WatchPartyContext.Provider value={{
      party,
      members,
      messages,
      reactions,
      isHost,
      isLoading,
      isSyncing,
      isWatchPartyGuest,
      createParty,
      joinParty,
      leaveParty,
      updatePlayback,
      setReady,
      sendMessage,
      sendReaction,
      startWatchingTogether,
      syncToParty
    }}>
      {children}
    </WatchPartyContext.Provider>
  );
}

// Safe hook that returns null if context is not available (for use outside provider)
export function useWatchPartyContextSafe() {
  return useContext(WatchPartyContext);
}

export function useWatchPartyContext() {
  const context = useContext(WatchPartyContext);
  if (!context) {
    throw new Error("useWatchPartyContext must be used within a WatchPartyProvider");
  }
  return context;
}
