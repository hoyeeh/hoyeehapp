import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  ChevronLeft, Clock, Eye, Calendar, 
  Trash2, Moon, TrendingUp, Film, User
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";

interface KidsMobileParentalDashboardProps {
  onBack: () => void;
}

export const KidsMobileParentalDashboard = ({ onBack }: KidsMobileParentalDashboardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { data: kidsProfiles = [] } = useQuery({
    queryKey: ["kids-profiles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_kids", true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: viewingHistory = [] } = useQuery({
    queryKey: ["kids-viewing-history", selectedProfileId],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("kids_viewing_history")
        .select(`
          *,
          content:content_id (title, thumbnail_url, duration)
        `)
        .eq("profile_id", selectedProfileId)
        .gte("watched_at", sevenDaysAgo)
        .order("watched_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProfileId,
  });

  const updateTimeLimitMutation = useMutation({
    mutationFn: async ({ profileId, timeLimit }: { profileId: string; timeLimit: number | null }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ daily_time_limit_minutes: timeLimit })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-profiles"] });
      toast.success("Time limit updated");
    },
  });

  const updateBedtimeMutation = useMutation({
    mutationFn: async ({ profileId, bedtime }: { profileId: string; bedtime: string | null }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ bedtime_time: bedtime })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-profiles"] });
      toast.success("Bedtime updated");
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("kids_viewing_history")
        .delete()
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-viewing-history"] });
      toast.success("History cleared");
    },
  });

  const selectedProfile = kidsProfiles.find((p: any) => p.id === selectedProfileId);
  const totalWatchedToday = selectedProfile?.time_watched_today_minutes || 0;
  const totalWatchedThisWeek = viewingHistory.reduce((sum: number, h: any) => 
    sum + (h.duration_watched_minutes || 0), 0
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-2xl border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="text-white hover:bg-white/[0.06] -ml-2"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </Button>
          <div>
            <h1 className="text-[17px] font-semibold text-white tracking-[-0.02em]">Parental Controls</h1>
            <p className="text-[13px] text-white/40 font-medium">Monitor activity</p>
          </div>
        </div>
      </div>

      <div className="p-5 pb-24 space-y-6">
        {/* Profile Selector */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 text-white/60">
            <User className="h-4 w-4" strokeWidth={2} />
            <span className="text-[13px] font-semibold tracking-wide uppercase">Profiles</span>
          </div>
          
          {kidsProfiles.length === 0 ? (
            <div className="bg-white/[0.04] rounded-2xl p-8 text-center border border-white/[0.06]">
              <p className="text-[15px] text-white/40 font-medium">No kids profiles found</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
              {kidsProfiles.map((profile: any) => (
                <motion.button
                  key={profile.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-2xl min-w-[100px] transition-all ${
                    selectedProfileId === profile.id
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                      : "bg-white/[0.04] border border-white/[0.06]"
                  }`}
                >
                  <img
                    src={profile.avatar_url || "/placeholder.svg"}
                    alt={profile.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/10"
                  />
                  <span className="text-[13px] font-semibold text-white truncate max-w-[80px]">
                    {profile.name}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {selectedProfile && (
          <>
            {/* Stats */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-400" strokeWidth={2} />
                  <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Today</span>
                </div>
                <p className="text-2xl font-bold text-white">{totalWatchedToday}</p>
                <p className="text-[11px] text-white/30 font-medium mt-1">minutes watched</p>
              </div>

              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-green-400" strokeWidth={2} />
                  <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Week</span>
                </div>
                <p className="text-2xl font-bold text-white">{totalWatchedThisWeek}</p>
                <p className="text-[11px] text-white/30 font-medium mt-1">minutes total</p>
              </div>

              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-purple-400" strokeWidth={2} />
                  <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Videos</span>
                </div>
                <p className="text-2xl font-bold text-white">{viewingHistory.length}</p>
                <p className="text-[11px] text-white/30 font-medium mt-1">this week</p>
              </div>

              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-amber-400" strokeWidth={2} />
                  <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Daily Avg</span>
                </div>
                <p className="text-2xl font-bold text-white">{Math.round(totalWatchedThisWeek / 7)}</p>
                <p className="text-[11px] text-white/30 font-medium mt-1">minutes</p>
              </div>
            </section>

            {/* Controls */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 text-white/60">
                <span className="text-[13px] font-semibold tracking-wide uppercase">Controls</span>
              </div>
              
              {/* Time Limit */}
              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-white">Daily Limit</p>
                      <p className="text-[12px] text-white/40 font-medium">
                        {selectedProfile.daily_time_limit_minutes 
                          ? `${selectedProfile.daily_time_limit_minutes} min/day`
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={!!selectedProfile.daily_time_limit_minutes}
                    onCheckedChange={(checked) => {
                      updateTimeLimitMutation.mutate({
                        profileId: selectedProfile.id,
                        timeLimit: checked ? 60 : null,
                      });
                    }}
                  />
                </div>
                
                {selectedProfile.daily_time_limit_minutes && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[30, 60, 90, 120].map((mins) => (
                      <Button
                        key={mins}
                        variant={selectedProfile.daily_time_limit_minutes === mins ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateTimeLimitMutation.mutate({
                          profileId: selectedProfile.id,
                          timeLimit: mins,
                        })}
                        className="rounded-full h-9 text-[13px] font-semibold"
                      >
                        {mins}m
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bedtime */}
              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Moon className="h-5 w-5 text-purple-400" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-white">Bedtime</p>
                      <p className="text-[12px] text-white/40 font-medium">
                        {(selectedProfile as any).bedtime_time || "Not set"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={!!(selectedProfile as any).bedtime_time}
                    onCheckedChange={(checked) => {
                      updateBedtimeMutation.mutate({
                        profileId: selectedProfile.id,
                        bedtime: checked ? "20:00" : null,
                      });
                    }}
                  />
                </div>
                
                {(selectedProfile as any).bedtime_time && (
                  <div className="mt-4">
                    <Input
                      type="time"
                      value={(selectedProfile as any).bedtime_time?.slice(0, 5) || "20:00"}
                      onChange={(e) => updateBedtimeMutation.mutate({
                        profileId: selectedProfile.id,
                        bedtime: e.target.value,
                      })}
                      className="bg-white/[0.06] border-white/[0.08] text-white w-32 h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* History */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-white/60">
                  <Film className="h-4 w-4" strokeWidth={2} />
                  <span className="text-[13px] font-semibold tracking-wide uppercase">History</span>
                </div>
                {viewingHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearHistoryMutation.mutate(selectedProfile.id)}
                    className="text-red-400 hover:text-red-300 h-8 text-[13px] font-semibold"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" strokeWidth={2} />
                    Clear
                  </Button>
                )}
              </div>

              {viewingHistory.length === 0 ? (
                <div className="bg-white/[0.04] rounded-2xl p-10 text-center border border-white/[0.06]">
                  <Eye className="h-10 w-10 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[15px] text-white/40 font-medium">No viewing history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingHistory.slice(0, 10).map((item: any, index: number) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.04]"
                    >
                      <img
                        src={item.content?.thumbnail_url || "/placeholder.svg"}
                        alt={item.content?.title}
                        className="w-16 h-10 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">
                          {item.content?.title}
                        </p>
                        <p className="text-[11px] text-white/40 font-medium">
                          {item.duration_watched_minutes}m
                          {item.completed && " • Done"}
                        </p>
                      </div>
                      <span className="text-[11px] text-white/30 font-medium">
                        {format(new Date(item.watched_at), "MMM d")}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};