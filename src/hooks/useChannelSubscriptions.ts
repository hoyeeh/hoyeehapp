import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChannelSubscription {
  id: string;
  user_id: string;
  channel_id: string;
  subscribed_at: string;
  notifications_enabled: boolean;
}

export function useChannelSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["channel-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("channel_subscriptions")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as ChannelSubscription[];
    },
    enabled: !!user,
  });
}

export function useIsSubscribedToChannel(channelId: string) {
  const { data: subscriptions } = useChannelSubscriptions();
  return subscriptions?.some((sub) => sub.channel_id === channelId) ?? false;
}

export function useSubscribedChannels() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscribed-channels", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("channel_subscriptions")
        .select(`
          id,
          channel_id,
          subscribed_at,
          notifications_enabled,
          youtube_channels (
            id,
            name,
            thumbnail_url,
            cover_url,
            subscriber_count,
            video_count,
            description
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useToggleChannelSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      isSubscribed,
    }: {
      channelId: string;
      isSubscribed: boolean;
    }) => {
      if (!user) throw new Error("Must be logged in");

      if (isSubscribed) {
        const { error } = await supabase
          .from("channel_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("channel_id", channelId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("channel_subscriptions")
          .insert({
            user_id: user.id,
            channel_id: channelId,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, { isSubscribed }) => {
      queryClient.invalidateQueries({ queryKey: ["channel-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscribed-channels"] });
      toast.success(isSubscribed ? "Unsubscribed from channel" : "Subscribed to channel");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update subscription");
    },
  });
}

export function useToggleNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      enabled,
    }: {
      channelId: string;
      enabled: boolean;
    }) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("channel_subscriptions")
        .update({ notifications_enabled: enabled })
        .eq("user_id", user.id)
        .eq("channel_id", channelId);

      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["channel-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscribed-channels"] });
      toast.success(enabled ? "Notifications enabled" : "Notifications disabled");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update notifications");
    },
  });
}
