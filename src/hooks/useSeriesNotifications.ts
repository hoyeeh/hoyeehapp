import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useSeriesNotifications = (contentId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user is subscribed to a specific series
  const { data: isSubscribed = false, isLoading } = useQuery({
    queryKey: ['series-subscription', user?.id, contentId],
    queryFn: async () => {
      if (!user || !contentId) return false;
      
      const { data, error } = await supabase
        .from('series_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', contentId)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!contentId
  });

  // Get all subscribed series
  const { data: subscribedSeries = [] } = useQuery({
    queryKey: ['series-subscriptions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('series_subscriptions')
        .select(`
          id,
          content_id,
          created_at,
          content:content_id (
            id,
            title,
            thumbnail_url,
            genre
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // Subscribe to a series
  const subscribeMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from('series_subscriptions')
        .insert({
          user_id: user.id,
          content_id: seriesId
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['series-subscriptions'] });
      toast.success("You'll be notified when new episodes are released!");
    },
    onError: () => {
      toast.error("Failed to subscribe to notifications");
    }
  });

  // Unsubscribe from a series
  const unsubscribeMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from('series_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', seriesId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['series-subscriptions'] });
      toast.info("Notifications disabled for this series");
    },
    onError: () => {
      toast.error("Failed to unsubscribe from notifications");
    }
  });

  const toggleSubscription = useCallback(async () => {
    if (!contentId) return;
    
    if (isSubscribed) {
      await unsubscribeMutation.mutateAsync(contentId);
    } else {
      await subscribeMutation.mutateAsync(contentId);
    }
  }, [contentId, isSubscribed, subscribeMutation, unsubscribeMutation]);

  return {
    isSubscribed,
    isLoading,
    subscribedSeries,
    subscribe: subscribeMutation.mutate,
    unsubscribe: unsubscribeMutation.mutate,
    toggleSubscription,
    isToggling: subscribeMutation.isPending || unsubscribeMutation.isPending
  };
};
