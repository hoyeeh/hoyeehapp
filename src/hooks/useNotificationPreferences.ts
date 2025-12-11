import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  new_releases: boolean;
  coming_soon_alerts: boolean;
  subscription_reminders: boolean;
  weekly_digest: boolean;
  promotional: boolean;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Return default preferences if none exist
      if (!data) {
        return {
          user_id: user.id,
          new_releases: true,
          coming_soon_alerts: true,
          subscription_reminders: true,
          weekly_digest: false,
          promotional: false,
        } as NotificationPreferences;
      }
      
      return data as NotificationPreferences;
    },
    enabled: !!user,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("Must be logged in");

      // Check if preferences exist
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("notification_preferences")
          .update(updates)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Notification preferences updated");
    },
    onError: (error) => {
      console.error("Error updating preferences:", error);
      toast.error("Failed to update preferences");
    },
  });

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
  };
}
