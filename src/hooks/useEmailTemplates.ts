import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  html_content: string;
  category: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export function useEmailTemplates(category?: string) {
  return useQuery({
    queryKey: ['email-templates', category],
    queryFn: async () => {
      let query = supabase
        .from('email_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: ['email-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id,
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<EmailTemplate, 'name' | 'description' | 'subject' | 'html_content' | 'is_active'>>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('email_templates')
        .update({
          ...updates,
          updated_by: user?.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-template'] });
      toast.success('Email template updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update email template:', error);
      toast.error('Failed to update email template');
    },
  });
}

export function useToggleEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('email_templates')
        .update({ is_active, updated_by: user?.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success(`Template ${data.is_active ? 'enabled' : 'disabled'}`);
    },
    onError: (error) => {
      console.error('Failed to toggle email template:', error);
      toast.error('Failed to toggle email template');
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async ({ templateKey, testEmail }: { templateKey: string; testEmail: string }) => {
      const { data, error } = await supabase.functions.invoke('send-subscription-email', {
        body: {
          to: testEmail,
          type: templateKey,
          data: {
            userName: 'Test User',
            planType: 'Monthly',
            amount: 5000,
            currency: 'XAF',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            daysUntilExpiry: 7,
            contentTitle: 'Test Content',
            creatorName: 'Test Creator',
            ticketSubject: 'Test Ticket',
            replyMessage: 'This is a test reply message.',
            rejectionReason: 'This is a test rejection reason.',
          },
          skipPreferenceCheck: true,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Test email sent successfully');
    },
    onError: (error) => {
      console.error('Failed to send test email:', error);
      toast.error('Failed to send test email');
    },
  });
}

export const EMAIL_CATEGORIES = [
  { value: 'all', label: 'All Templates' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'user', label: 'User' },
  { value: 'creator', label: 'Creator' },
  { value: 'content', label: 'Content' },
  { value: 'support', label: 'Support' },
  { value: 'general', label: 'General' },
];
