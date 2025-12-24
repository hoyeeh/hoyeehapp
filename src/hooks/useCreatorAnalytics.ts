import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorProfile } from "./useCreator";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "month";

export const useCreatorAnalytics = (creatorId?: string, period: 'week' | 'month' = "week") => {
  const { data: creatorProfile } = useCreatorProfile();
  const id = creatorId || creatorProfile?.id;
  
  return useQuery({
    queryKey: ["creator-analytics", id, period],
    queryFn: async () => {
      if (!id) return [];
      
      const days = period === 'week' ? 7 : 30;
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("creator_analytics")
        .select("*")
        .eq("creator_id", id)
        .gte("date", startDate)
        .order("date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });
};

export const useCreatorReports = (creatorId?: string) => {
  const { data: creatorProfile } = useCreatorProfile();
  const id = creatorId || creatorProfile?.id;
  
  return useQuery({
    queryKey: ["creator-reports", id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from("creator_reports")
        .select("*")
        .eq("creator_id", id)
        .order("generated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });
};

export const useTopContent = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["top-content", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("created_by", creatorProfile.user_id)
        .order("view_count", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!creatorProfile,
  });
};

export const useGenerateReport = () => {
  return useMutation({
    mutationFn: async ({ 
      creatorId, 
      reportType 
    }: { 
      creatorId: string; 
      reportType: "weekly" | "monthly"; 
    }) => {
      const { data, error } = await supabase.functions.invoke("creator-report", {
        body: {
          action: reportType === "weekly" ? "generate-weekly" : "generate-monthly",
          creatorId,
          reportType,
        },
      });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useRevenueOverTime = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["revenue-over-time", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      // Get sales grouped by date for the last 30 days
      const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      
      const { data: sales, error } = await supabase
        .from("content_purchases")
        .select("created_at, creator_share")
        .eq("creator_id", creatorProfile.id)
        .eq("status", "completed")
        .gte("created_at", `${startDate}T00:00:00`)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      // Group by date
      const revenueByDate: Record<string, number> = {};
      (sales || []).forEach(sale => {
        const date = format(new Date(sale.created_at), "yyyy-MM-dd");
        revenueByDate[date] = (revenueByDate[date] || 0) + Number(sale.creator_share);
      });
      
      // Get tips grouped by date
      const { data: tips } = await supabase
        .from("creator_tips")
        .select("created_at, amount")
        .eq("creator_id", creatorProfile.id)
        .eq("status", "completed")
        .gte("created_at", `${startDate}T00:00:00`)
        .order("created_at", { ascending: true });
      
      const tipsByDate: Record<string, number> = {};
      (tips || []).forEach(tip => {
        const date = format(new Date(tip.created_at), "yyyy-MM-dd");
        tipsByDate[date] = (tipsByDate[date] || 0) + Number(tip.amount);
      });
      
      // Combine into chart data
      const allDates = new Set([...Object.keys(revenueByDate), ...Object.keys(tipsByDate)]);
      const chartData = Array.from(allDates)
        .sort()
        .map(date => ({
          date,
          sales: revenueByDate[date] || 0,
          tips: tipsByDate[date] || 0,
          total: (revenueByDate[date] || 0) + (tipsByDate[date] || 0),
        }));
      
      return chartData;
    },
    enabled: !!creatorProfile,
  });
};
