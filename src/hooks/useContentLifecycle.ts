import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LifecycleStatus = 'active' | 'leaving_soon' | 'hidden' | 'kept';

export interface ContentWithLifecycle {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
  genre: string | null;
  lifecycle_status: string;
  expires_at: string | null;
  views_last_30_days: number;
  admin_override: boolean;
  lifecycle_reason: string | null;
  lifecycle_updated_at: string | null;
  created_at: string | null;
}

export interface LifecycleStats {
  active: number;
  leavingSoon: number;
  hidden: number;
  kept: number;
  total: number;
}

export function useContentLifecycle(status?: LifecycleStatus) {
  return useQuery({
    queryKey: ['content-lifecycle', status],
    queryFn: async () => {
      let query = supabase
        .from('content')
        .select('id, title, thumbnail_url, content_type, genre, lifecycle_status, expires_at, views_last_30_days, admin_override, lifecycle_reason, lifecycle_updated_at, created_at')
        .order('expires_at', { ascending: true });

      if (status) {
        query = query.eq('lifecycle_status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContentWithLifecycle[];
    },
  });
}

export function useLifecycleStats() {
  return useQuery({
    queryKey: ['lifecycle-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content')
        .select('lifecycle_status');

      if (error) throw error;

      const stats: LifecycleStats = {
        active: 0,
        leavingSoon: 0,
        hidden: 0,
        kept: 0,
        total: data.length,
      };

      data.forEach((item) => {
        switch (item.lifecycle_status) {
          case 'active':
            stats.active++;
            break;
          case 'leaving_soon':
            stats.leavingSoon++;
            break;
          case 'hidden':
            stats.hidden++;
            break;
          case 'kept':
            stats.kept++;
            break;
        }
      });

      return stats;
    },
  });
}

export function useLifecycleLogs(contentId?: string) {
  return useQuery({
    queryKey: ['lifecycle-logs', contentId],
    queryFn: async () => {
      let query = supabase
        .from('content_lifecycle_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (contentId) {
        query = query.eq('content_id', contentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateLifecycleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentId,
      status,
      reason,
      adminOverride,
      extendDays,
    }: {
      contentId: string;
      status?: LifecycleStatus;
      reason?: string;
      adminOverride?: boolean;
      extendDays?: number;
    }) => {
      const updates: Record<string, unknown> = {
        lifecycle_updated_at: new Date().toISOString(),
      };

      if (status) updates.lifecycle_status = status;
      if (reason) updates.lifecycle_reason = reason;
      if (adminOverride !== undefined) updates.admin_override = adminOverride;

      if (extendDays) {
        const { data: current } = await supabase
          .from('content')
          .select('expires_at')
          .eq('id', contentId)
          .single();

        const currentExpiry = current?.expires_at ? new Date(current.expires_at) : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + extendDays * 24 * 60 * 60 * 1000);
        updates.expires_at = newExpiry.toISOString();
      }

      const { error } = await supabase
        .from('content')
        .update(updates as any)
        .eq('id', contentId);

      if (error) throw error;

      // Log the change
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('content_lifecycle_logs').insert({
        content_id: contentId,
        previous_status: null,
        new_status: status || 'updated',
        reason: reason || `Admin action: ${status ? `Set to ${status}` : ''} ${extendDays ? `Extended by ${extendDays} days` : ''} ${adminOverride !== undefined ? `Override: ${adminOverride}` : ''}`.trim(),
        changed_by: 'admin',
        admin_id: userData.user?.id,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-logs'] });
      toast.success('Content lifecycle updated');
    },
    onError: (error) => {
      console.error('Failed to update lifecycle:', error);
      toast.error('Failed to update content lifecycle');
    },
  });
}

export function useBulkUpdateLifecycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentIds,
      status,
      extendDays,
      adminOverride,
    }: {
      contentIds: string[];
      status?: LifecycleStatus;
      extendDays?: number;
      adminOverride?: boolean;
    }) => {
      for (const contentId of contentIds) {
        const updates: Record<string, unknown> = {
          lifecycle_updated_at: new Date().toISOString(),
        };

        if (status) updates.lifecycle_status = status;
        if (typeof adminOverride === 'boolean') updates.admin_override = adminOverride;

        if (extendDays) {
          const { data: current } = await supabase
            .from('content')
            .select('expires_at')
            .eq('id', contentId)
            .single();

          const currentExpiry = current?.expires_at ? new Date(current.expires_at) : new Date();
          const newExpiry = new Date(currentExpiry.getTime() + extendDays * 24 * 60 * 60 * 1000);
          updates.expires_at = newExpiry.toISOString();
        }

        await supabase
          .from('content')
          .update(updates as any)
          .eq('id', contentId);
      }

      return { success: true, count: contentIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-stats'] });
      toast.success(`Updated ${data.count} content items`);
    },
    onError: (error) => {
      console.error('Bulk update failed:', error);
      toast.error('Failed to update content');
    },
  });
}

export function useRunLifecycleCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('content-lifecycle-manager');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-logs'] });
      toast.success(`Lifecycle check complete: ${data.results?.updated?.length || 0} items updated`);
    },
    onError: (error) => {
      console.error('Lifecycle check failed:', error);
      toast.error('Failed to run lifecycle check');
    },
  });
}

export function useAIAnalysis() {
  return useMutation({
    mutationFn: async ({ contentId, action }: { contentId: string; action?: string }) => {
      const { data, error } = await supabase.functions.invoke('content-lifecycle-ai', {
        body: { contentId, action },
      });
      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error('Content analysis failed:', error);
      toast.error('Failed to run content analysis');
    },
  });
}
