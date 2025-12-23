import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Fetch all active paid content for the store
export const usePaidContentForStore = (filters?: {
  creatorId?: string;
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'sales' | 'recent';
}) => {
  return useQuery({
    queryKey: ["paid-content-store", filters],
    queryFn: async () => {
      let query = supabase
        .from('paid_content')
        .select(`
          *,
          content!inner(*),
          creator_profiles!inner(id, display_name, avatar_url, is_verified)
        `)
        .eq('is_active', true);

      if (filters?.creatorId) {
        query = query.eq('creator_id', filters.creatorId);
      }

      if (filters?.genre) {
        query = query.ilike('content.genre', `%${filters.genre}%`);
      }

      if (filters?.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }

      if (filters?.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      // Sorting
      switch (filters?.sortBy) {
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'sales':
          query = query.order('sale_count', { ascending: false });
          break;
        case 'recent':
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch paid content for home page row
export const usePaidContentForHome = () => {
  return useQuery({
    queryKey: ["paid-content-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paid_content')
        .select(`
          *,
          content(*),
          creator_profiles(id, display_name, avatar_url, is_verified)
        `)
        .eq('is_active', true)
        .order('sale_count', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch all creators with paid content
export const useCreatorsWithContent = () => {
  return useQuery({
    queryKey: ["creators-with-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('id, display_name, avatar_url, is_verified')
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch unique genres from paid content
export const usePaidContentGenres = () => {
  return useQuery({
    queryKey: ["paid-content-genres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paid_content')
        .select('content(genre)')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Extract unique genres
      const genres = new Set<string>();
      data?.forEach((item: any) => {
        if (item.content?.genre) {
          item.content.genre.split(',').forEach((g: string) => {
            genres.add(g.trim());
          });
        }
      });
      
      return Array.from(genres).sort();
    },
  });
};

// Initialize purchase
export const useInitializePurchase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contentId: string) => {
      const { data, error } = await supabase.functions.invoke('purchase-content', {
        body: {
          action: 'initialize',
          contentId
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to initiate purchase");
    }
  });
};

// Verify purchase
export const useVerifyPurchase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (txRef: string) => {
      const { data, error } = await supabase.functions.invoke('purchase-content', {
        body: {
          action: 'verify',
          txRef
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["has-purchased"] });
      queryClient.invalidateQueries({ queryKey: ["user-purchases"] });
      toast.success("Purchase completed successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Payment verification failed");
    }
  });
};

// Get user's purchased content
export const useUserPurchases = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('content_purchases')
        .select('*, content(*), creator_profiles:creator_id(display_name)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

// Get price range for filters
export const usePriceRange = () => {
  return useQuery({
    queryKey: ["paid-content-price-range"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paid_content')
        .select('price')
        .eq('is_active', true)
        .order('price');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return { min: 0, max: 10000 };
      }
      
      return {
        min: Math.floor(data[0].price),
        max: Math.ceil(data[data.length - 1].price)
      };
    },
  });
};
