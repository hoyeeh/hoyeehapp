import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Baby, Clock, Eye, Calendar, ChevronLeft, 
  Trash2, Moon, TrendingUp, Film
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

  // Fetch kids profiles
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

  // Fetch viewing history for selected profile
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

  // Mutations
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
      toast.success("Time limit updated!");
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
      toast.success("Bedtime updated!");
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
      toast.success("History cleared!");
    },
  });

  const selectedProfile = kidsProfiles.find((p: any) => p.id === selectedProfileId);
  const totalWatchedToday = selectedProfile?.time_watched_today_minutes || 0;
  const totalWatchedThisWeek = viewingHistory.reduce((sum: number, h: any) => 
    sum + (h.duration_watched_minutes || 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Parental Dashboard</h1>
            <p className="text-sm text-white/60">Monitor kids activity</p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-24 space-y-6">
        {/* Profile Selector */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-white/80">
            <Baby className="h-5 w-5" />
            <span className="font-medium">Kids Profiles</span>
          </div>
          
          {kidsProfiles.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-6 text-center">
              <p className="text-white/60">No kids profiles found</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {kidsProfiles.map((profile: any) => (
                <motion.button
                  key={profile.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl min-w-[100px] transition-all ${
                    selectedProfileId === profile.id
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <img
                    src={profile.avatar_url || "/placeholder.svg"}
                    alt={profile.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20"
                  />
                  <span className="text-sm font-medium text-white truncate max-w-[80px]">
                    {profile.name}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.section>

        {selectedProfile && (
          <>
            {/* Stats Grid */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <span className="text-xs text-white/60">Today</span>
                </div>
                <p className="text-2xl font-bold text-white">{totalWatchedToday}</p>
                <p className="text-xs text-white/50">minutes watched</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl p-4 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-green-400" />
                  <span className="text-xs text-white/60">This Week</span>
                </div>
                <p className="text-2xl font-bold text-white">{totalWatchedThisWeek}</p>
                <p className="text-xs text-white/50">minutes total</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-violet-500/10 rounded-2xl p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-purple-400" />
                  <span className="text-xs text-white/60">Videos</span>
                </div>
                <p className="text-2xl font-bold text-white">{viewingHistory.length}</p>
                <p className="text-xs text-white/50">watched this week</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-2xl p-4 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                  <span className="text-xs text-white/60">Avg/Day</span>
                </div>
                <p className="text-2xl font-bold text-white">{Math.round(totalWatchedThisWeek / 7)}</p>
                <p className="text-xs text-white/50">minutes</p>
              </div>
            </motion.section>

            {/* Time Limit Progress */}
            {selectedProfile.daily_time_limit_minutes && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/5 rounded-2xl p-4 border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Time Limit Progress</span>
                  <span className="text-xs text-white/60">
                    {totalWatchedToday} / {selectedProfile.daily_time_limit_minutes} min
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min(100, (totalWatchedToday / selectedProfile.daily_time_limit_minutes) * 100)}%` 
                    }}
                    className={`h-full rounded-full ${
                      totalWatchedToday >= selectedProfile.daily_time_limit_minutes
                        ? "bg-gradient-to-r from-red-500 to-orange-500"
                        : "bg-gradient-to-r from-green-500 to-emerald-500"
                    }`}
                  />
                </div>
                <p className="text-xs text-white/50 mt-2">
                  {Math.max(0, selectedProfile.daily_time_limit_minutes - totalWatchedToday)} minutes remaining today
                </p>
              </motion.section>
            )}

            {/* Controls */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-white/80">Controls</h3>
              
              {/* Time Limit Toggle */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/20">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Daily Limit</p>
                      <p className="text-xs text-white/50">
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
                    {[30, 60, 90, 120, 180].map((mins) => (
                      <Button
                        key={mins}
                        variant={selectedProfile.daily_time_limit_minutes === mins ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateTimeLimitMutation.mutate({
                          profileId: selectedProfile.id,
                          timeLimit: mins,
                        })}
                        className="rounded-full"
                      >
                        {mins} min
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bedtime Toggle */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20">
                      <Moon className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Bedtime Mode</p>
                      <p className="text-xs text-white/50">
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
                      className="bg-white/5 border-white/10 text-white w-32"
                    />
                  </div>
                )}
              </div>
            </motion.section>

            {/* Viewing History */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80">
                  <Film className="h-5 w-5" />
                  <span className="font-medium">Recent History</span>
                </div>
                {viewingHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearHistoryMutation.mutate(selectedProfile.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {viewingHistory.length === 0 ? (
                <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/10">
                  <Eye className="h-10 w-10 text-white/20 mx-auto mb-2" />
                  <p className="text-white/50">No viewing history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingHistory.slice(0, 10).map((item: any, index: number) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5"
                    >
                      <img
                        src={item.content?.thumbnail_url || "/placeholder.svg"}
                        alt={item.content?.title}
                        className="w-16 h-10 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.content?.title}
                        </p>
                        <p className="text-xs text-white/50">
                          {item.duration_watched_minutes} min
                          {item.completed && " • Completed"}
                        </p>
                      </div>
                      <span className="text-xs text-white/40">
                        {format(new Date(item.watched_at), "MMM d")}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          </>
        )}
      </div>
    </div>
  );
};
