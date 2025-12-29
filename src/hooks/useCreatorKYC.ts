import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCreatorProfile } from "./useCreator";

interface KYCData {
  full_name: string;
  date_of_birth?: string;
  nationality?: string;
  email: string;
  phone_number: string;
  address_line1?: string;
  address_city?: string;
  address_country?: string;
  id_type: 'national_id' | 'drivers_license' | 'passport';
  id_number: string;
  id_document_url: string;
  id_expiry_date?: string;
}

export function useCreatorKYC() {
  const { data: creatorProfile } = useCreatorProfile();

  return useQuery({
    queryKey: ['creator-kyc', creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile?.id) return null;
      
      const { data, error } = await supabase
        .from('creator_kyc')
        .select('*')
        .eq('creator_id', creatorProfile.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile?.id,
  });
}

export function useSubmitKYC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: creatorProfile } = useCreatorProfile();

  return useMutation({
    mutationFn: async (kycData: KYCData) => {
      if (!creatorProfile?.id) throw new Error('No creator profile found');

      // Check if KYC already exists
      const { data: existing } = await supabase
        .from('creator_kyc')
        .select('id')
        .eq('creator_id', creatorProfile.id)
        .maybeSingle();

      if (existing) {
        // Update existing KYC
        const { data, error } = await supabase
          .from('creator_kyc')
          .update({
            ...kycData,
            status: 'pending',
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('creator_id', creatorProfile.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new KYC
        const { data, error } = await supabase
          .from('creator_kyc')
          .insert({
            creator_id: creatorProfile.id,
            ...kycData,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: async () => {
      // Update creator profile KYC status
      if (creatorProfile?.id) {
        await supabase
          .from('creator_profiles')
          .update({ kyc_status: 'pending' })
          .eq('id', creatorProfile.id);
      }

      queryClient.invalidateQueries({ queryKey: ['creator-kyc'] });
      queryClient.invalidateQueries({ queryKey: ['creator-profile'] });
      
      toast({
        title: "KYC Submitted",
        description: "Your verification documents have been submitted for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUploadKYCDocument() {
  const { data: creatorProfile } = useCreatorProfile();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!creatorProfile?.user_id) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      // Use user_id as first folder for RLS policy compliance
      const fileName = `${creatorProfile.user_id}/kyc/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL with 1-year expiry for long-term access
      const ONE_YEAR_SECONDS = 31536000;
      const { data, error } = await supabase.storage
        .from('creator-uploads')
        .createSignedUrl(fileName, ONE_YEAR_SECONDS);

      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// Admin hooks
export function useAllKYCSubmissions(status?: string) {
  return useQuery({
    queryKey: ['admin-kyc-submissions', status],
    queryFn: async () => {
      let query = supabase
        .from('creator_kyc')
        .select(`
          *,
          creator_profiles (
            id,
            display_name,
            user_id,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useReviewKYC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      kycId, 
      creatorId,
      status, 
      rejectionReason 
    }: { 
      kycId: string; 
      creatorId: string;
      status: 'approved' | 'declined'; 
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update KYC record
      const { error: kycError } = await supabase
        .from('creator_kyc')
        .update({
          status,
          rejection_reason: rejectionReason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', kycId);

      if (kycError) throw kycError;

      // Update creator profile
      const { error: profileError } = await supabase
        .from('creator_profiles')
        .update({
          kyc_status: status,
          kyc_verified_at: status === 'approved' ? new Date().toISOString() : null,
          can_request_payout: status === 'approved',
        })
        .eq('id', creatorId);

      if (profileError) throw profileError;

      // Send email notification
      await supabase.functions.invoke('send-subscription-email', {
        body: {
          type: status === 'approved' ? 'creator-kyc-approved' : 'creator-kyc-declined',
          creatorId,
          rejectionReason,
        },
      });

      return { status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-submissions'] });
      toast({
        title: data.status === 'approved' ? "KYC Approved" : "KYC Declined",
        description: data.status === 'approved' 
          ? "Creator can now request payouts."
          : "Creator has been notified.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Review Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
