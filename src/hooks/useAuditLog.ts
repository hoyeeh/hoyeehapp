import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AuditAction = 
  | 'create' | 'update' | 'delete' 
  | 'grant_credit' | 'revoke_credit'
  | 'promote_role' | 'demote_role' | 'remove_role'
  | 'reset_pin' | 'reset_secret' | 'unlock_account'
  | 'toggle_subscription' | 'apply_discount'
  | 'send_notification' | 'send_email'
  | 'assign_ticket' | 'close_ticket';

export type ResourceType = 
  | 'content' | 'episode' | 'season' | 'genre'
  | 'user' | 'profile' | 'user_role' | 'subscription'
  | 'subscription_credit' | 'subscription_settings'
  | 'hero_banner' | 'home_section' | 'top_10'
  | 'coming_soon' | 'notification' | 'support_ticket';

interface AuditLogParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = async ({ action, resourceType, resourceId, details }: AuditLogParams) => {
    if (!user?.id) {
      console.warn('Cannot log audit action: No authenticated user');
      return;
    }

    try {
      // Use type assertion since audit_logs table was just created
      const { error } = await (supabase as any)
        .from('audit_logs')
        .insert({
          admin_id: user.id,
          action,
          resource_type: resourceType,
          resource_id: resourceId || null,
          details: details || {},
        });

      if (error) {
        // Don't throw - audit logging shouldn't break the main flow
        console.error('Failed to log audit action:', error);
      }
    } catch (err) {
      console.error('Audit logging error:', err);
    }
  };

  return { logAction };
};

// Standalone function for use outside of React components
export const logAuditAction = async (
  adminId: string,
  { action, resourceType, resourceId, details }: AuditLogParams
) => {
  try {
    // Use type assertion since audit_logs table was just created
    const { error } = await (supabase as any)
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        details: details || {},
      });

    if (error) {
      console.error('Failed to log audit action:', error);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
};
