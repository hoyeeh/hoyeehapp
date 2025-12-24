import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCreatorProfile } from "./useCreator";

interface ContentSubmissionData {
  title: string;
  description?: string;
  genre?: string;
  content_type?: string;
  age_group?: string;
  release_date?: string;
  price_per_view?: number;
  video_url?: string;
  cover_image_url?: string;
  poster_image_url?: string;
  duration?: number;
}

export function useCreatorContentSubmissions() {
  const { data: creatorProfile } = useCreatorProfile();

  return useQuery({
    queryKey: ['creator-content-submissions', creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('creator_content_submissions')
        .select('*')
        .eq('creator_id', creatorProfile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile?.id,
  });
}

export function useSubmitContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: creatorProfile } = useCreatorProfile();

  return useMutation({
    mutationFn: async (contentData: ContentSubmissionData) => {
      if (!creatorProfile?.id) throw new Error('No creator profile found');

      const { data, error } = await supabase
        .from('creator_content_submissions')
        .insert({
          creator_id: creatorProfile.id,
          ...contentData,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification email
      await supabase.functions.invoke('send-subscription-email', {
        body: {
          type: 'creator-content-submitted',
          creatorId: creatorProfile.id,
          contentTitle: contentData.title,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-content-submissions'] });
      toast({
        title: "Content Submitted",
        description: "Your content has been submitted for review.",
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

export function useUploadCreatorMedia() {
  const { data: creatorProfile } = useCreatorProfile();

  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'video' | 'cover' | 'poster' }) => {
      if (!creatorProfile?.user_id) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `content/${creatorProfile.user_id}/${type}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('creator-uploads')
        .getPublicUrl(fileName);

      return publicUrl;
    },
  });
}

// Admin hooks
export function useAllContentSubmissions(status?: string) {
  return useQuery({
    queryKey: ['admin-content-submissions', status],
    queryFn: async () => {
      let query = supabase
        .from('creator_content_submissions')
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

export function useReviewContentSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      submissionId, 
      creatorId,
      status, 
      rejectionReason 
    }: { 
      submissionId: string; 
      creatorId: string;
      status: 'approved' | 'rejected'; 
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the submission details
      const { data: submission, error: fetchError } = await supabase
        .from('creator_content_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (fetchError) throw fetchError;

      let contentId = null;

      if (status === 'approved') {
        // Create content entry
        const { data: content, error: contentError } = await supabase
          .from('content')
          .insert({
            title: submission.title,
            description: submission.description,
            genre: submission.genre,
            content_type: submission.content_type || 'movie',
            content_rating: submission.age_group || 'PG',
            video_url: submission.video_url,
            thumbnail_url: submission.poster_image_url || submission.cover_image_url,
            duration: submission.duration,
            year: submission.release_date ? new Date(submission.release_date).getFullYear() : new Date().getFullYear(),
            created_by: creatorId,
          })
          .select()
          .single();

        if (contentError) throw contentError;
        contentId = content.id;

        // Create paid_content entry if price is set
        if (submission.price_per_view && submission.price_per_view > 0) {
          const { error: paidError } = await supabase
            .from('paid_content')
            .insert({
              content_id: content.id,
              creator_id: creatorId,
              price: submission.price_per_view,
              is_active: true,
            });

          if (paidError) throw paidError;
        }
      }

      // Update submission record
      const { error: updateError } = await supabase
        .from('creator_content_submissions')
        .update({
          status,
          content_id: contentId,
          rejection_reason: rejectionReason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Send email notification
      await supabase.functions.invoke('send-subscription-email', {
        body: {
          type: status === 'approved' ? 'creator-content-approved' : 'creator-content-rejected',
          creatorId,
          contentTitle: submission.title,
          rejectionReason,
        },
      });

      return { status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-content-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['creator-content-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
      toast({
        title: data.status === 'approved' ? "Content Approved" : "Content Rejected",
        description: data.status === 'approved' 
          ? "Content is now live on the platform."
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
