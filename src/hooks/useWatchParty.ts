import { useState, useEffect, useCallback } from "react";
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
}

export const useWatchParty = () => {
  const { user } = useAuth();
  const [party, setParty] = useState<WatchParty | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Generate unique party code
  const generateCode = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_party_code');
    if (error) {
      // Fallback to client-side generation
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

  // Join an existing party
  const joinParty = useCallback(async (code: string) => {
    if (!user) {
      toast.error("Please sign in to join a watch party");
      return null;
    }

    setIsLoading(true);
    try {
      // Find the party
      const { data: partyData, error: partyError } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('party_code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (partyError || !partyData) {
        toast.error("Party not found or has ended");
        return null;
      }

      // Join the party
      const { error: joinError } = await supabase
        .from('watch_party_members')
        .upsert({
          party_id: partyData.id,
          user_id: user.id,
          is_ready: false
        });

      if (joinError) throw joinError;

      setParty(partyData);
      setIsHost(partyData.host_user_id === user.id);
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
        // End the party if host leaves
        await supabase
          .from('watch_parties')
          .update({ is_active: false })
          .eq('id', party.id);
      } else {
        // Just remove member
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('party_id', party.id)
          .eq('user_id', user.id);
      }

      setParty(null);
      setMembers([]);
      setIsHost(false);
      toast.info(isHost ? "Watch party ended" : "Left watch party");
    } catch (error) {
      console.error("Failed to leave party:", error);
    }
  }, [party, user, isHost]);

  // Update playback state (host only)
  const updatePlayback = useCallback(async (time: number, playing: boolean) => {
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
  }, [party, isHost]);

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

  // Subscribe to real-time updates
  useEffect(() => {
    if (!party) return;

    // Subscribe to party updates
    const partyChannel = supabase
      .channel(`party-${party.id}`)
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
          // Refresh members list
          const { data } = await supabase
            .from('watch_party_members')
            .select('*')
            .eq('party_id', party.id);
          
          if (data) setMembers(data);
        }
      )
      .subscribe();

    // Fetch initial members
    supabase
      .from('watch_party_members')
      .select('*')
      .eq('party_id', party.id)
      .then(({ data }) => {
        if (data) setMembers(data);
      });

    return () => {
      supabase.removeChannel(partyChannel);
    };
  }, [party?.id]);

  return {
    party,
    members,
    isHost,
    isLoading,
    createParty,
    joinParty,
    leaveParty,
    updatePlayback,
    setReady
  };
};
