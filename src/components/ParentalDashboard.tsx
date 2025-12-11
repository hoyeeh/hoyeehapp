import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Baby, Clock, Eye, Calendar, ChevronLeft, 
  Trash2, Settings, History, Shield
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface ParentalDashboardProps {
  onBack: () => void;
}

export const ParentalDashboard = ({ onBack }: ParentalDashboardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

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

  // Update time limit mutation
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

  // Clear viewing history mutation
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
      toast.success("Viewing history cleared!");
    },
  });

  const selectedProfile = kidsProfiles.find((p: any) => p.id === selectedProfileId);

  // Calculate stats
  const totalWatchedToday = selectedProfile?.time_watched_today_minutes || 0;
  const totalWatchedThisWeek = viewingHistory.reduce((sum: number, h: any) => 
    sum + (h.duration_watched_minutes || 0), 0
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-display">Parental Dashboard</h1>
          </div>
        </div>

        {/* Kids Profile Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5" />
              Kids Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kidsProfiles.length === 0 ? (
              <p className="text-muted-foreground">No kids profiles found. Create a kids profile first.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {kidsProfiles.map((profile: any) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      selectedProfileId === profile.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={profile.avatar_url || "/placeholder.svg"}
                      alt={profile.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="text-left">
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.daily_time_limit_minutes 
                          ? `${profile.daily_time_limit_minutes} min/day limit`
                          : "No time limit"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedProfile && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-blue-500/20">
                      <Clock className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Watched Today</p>
                      <p className="text-2xl font-bold">{totalWatchedToday} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-green-500/20">
                      <Calendar className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">This Week</p>
                      <p className="text-2xl font-bold">{totalWatchedThisWeek} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-purple-500/20">
                      <Eye className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Videos Watched</p>
                      <p className="text-2xl font-bold">{viewingHistory.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Time Limit Settings */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Time Limit Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Daily Time Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit how long {selectedProfile.name} can watch per day
                    </p>
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

                {selectedProfile.daily_time_limit_minutes !== null && (
                  <div className="space-y-2">
                    <Label>Daily Limit (minutes)</Label>
                    <div className="flex gap-2">
                      {[30, 60, 90, 120, 180].map((mins) => (
                        <Button
                          key={mins}
                          variant={selectedProfile.daily_time_limit_minutes === mins ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            updateTimeLimitMutation.mutate({
                              profileId: selectedProfile.id,
                              timeLimit: mins,
                            });
                          }}
                        >
                          {mins} min
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Label>Custom:</Label>
                      <Input
                        type="number"
                        min={10}
                        max={480}
                        className="w-24"
                        value={selectedProfile.daily_time_limit_minutes || ""}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (value >= 10 && value <= 480) {
                            updateTimeLimitMutation.mutate({
                              profileId: selectedProfile.id,
                              timeLimit: value,
                            });
                          }
                        }}
                      />
                      <span className="text-muted-foreground">minutes</span>
                    </div>
                  </div>
                )}

                {selectedProfile.daily_time_limit_minutes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      <strong>Time remaining today:</strong>{" "}
                      {Math.max(0, selectedProfile.daily_time_limit_minutes - totalWatchedToday)} minutes
                    </p>
                    <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, (totalWatchedToday / selectedProfile.daily_time_limit_minutes) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Viewing History */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Viewing History
                </CardTitle>
                {viewingHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearHistoryMutation.mutate(selectedProfile.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear History
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {viewingHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No viewing history yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {viewingHistory.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                      >
                        <img
                          src={item.content?.thumbnail_url || "/placeholder.svg"}
                          alt={item.content?.title}
                          className="w-16 h-10 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.content?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Watched {item.duration_watched_minutes} min
                            {item.completed && " • Completed"}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {format(new Date(item.watched_at), "MMM d, h:mm a")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
