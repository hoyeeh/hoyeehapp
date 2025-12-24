import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorProfile } from "./useCreator";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "month";

export const useCreatorAnalytics = (period: AnalyticsPeriod = "30d") => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-analytics", creatorProfile?.id, period],
    queryFn: async () => {
      if (!creatorProfile) return null;
      
      let startDate: string;
      let endDate: string = format(new Date(), "yyyy-MM-dd");
      
      switch (period) {
        case "7d":
          startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
          break;
        case "30d":
          startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
          break;
        case "90d":
          startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
          break;
        case "month":
          startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
          endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");
          break;
        default:
          startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      }
      
      const { data, error } = await supabase.functions.invoke("creator-analytics", {
        body: {
          action: "get-analytics",
          creatorId: creatorProfile.id,
          startDate,
          endDate,
        },
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

export const useTopContent = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["top-content", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase.functions.invoke("creator-analytics", {
        body: {
          action: "get-top-content",
          creatorId: creatorProfile.id,
        },
      });
      
      if (error) throw error;
      return data.content || [];
    },
    enabled: !!creatorProfile,
  });
};

export const useCreatorReports = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-reports", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase.functions.invoke("creator-report", {
        body: {
          action: "get-reports",
          creatorId: creatorProfile.id,
        },
      });
      
      if (error) throw error;
      return data.reports || [];
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
