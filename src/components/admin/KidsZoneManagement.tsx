import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Trash2, Edit2, Save, X, Baby, Tag, Clock, Moon, 
  Users, BarChart3, Eye, Calendar, Star, Shield, Mail, Send, Loader2,
  RotateCcw, TrendingUp, Download, FileText, Sparkles, Youtube
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportToCSV, exportToPDF } from "@/utils/exportReport";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT } from "@/constants/kidsRatings";
import { KidsYouTubeTab } from "./KidsYouTubeTab";

const GRADIENT_OPTIONS = [
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-purple-500 to-violet-500", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-green-500 to-emerald-500", label: "Green" },
  { value: "from-yellow-500 to-orange-500", label: "Orange" },
  { value: "from-red-500 to-rose-500", label: "Red" },
  { value: "from-indigo-500 to-purple-500", label: "Indigo" },
  { value: "from-cyan-500 to-teal-500", label: "Teal" },
];

const EMOJI_OPTIONS = ["📚", "🌙", "🎵", "🚀", "🦁", "🦸", "🎨", "🎮", "🌈", "🎪", "🎬", "⭐", "🎭", "🎯"];

const TIME_LIMIT_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 0, label: "Unlimited" },
];

export const KidsZoneManagement = () => {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    emoji: "📚",
    color: "from-pink-500 to-rose-500",
  });

  // Fetch weekly report preview data
  const { data: reportPreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["admin-weekly-report-preview"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Get all kids profiles with their parent info
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, name, user_id, daily_time_limit_minutes, bedtime_time, time_watched_today_minutes")
        .eq("is_kids", true);

      if (!profiles?.length) return { profiles: [], viewingData: [] };

      // Get viewing history for the past week
      const { data: viewingHistory } = await supabase
        .from("kids_viewing_history")
        .select(`
          profile_id,
          duration_watched_minutes,
          completed,
          watched_at,
          content:content_id(title, thumbnail_url)
        `)
        .gte("watched_at", sevenDaysAgo.toISOString())
        .order("watched_at", { ascending: false });

      // Group by profile
      const groupedData = profiles.map(profile => {
        const history = viewingHistory?.filter(v => v.profile_id === profile.id) || [];
        const totalMinutes = history.reduce((sum, v) => sum + (v.duration_watched_minutes || 0), 0);
        const uniqueContent = [...new Set(history.map(v => (v.content as any)?.title))].filter(Boolean);
        
        return {
          profile,
          totalMinutes,
          videosWatched: history.length,
          uniqueContent: uniqueContent.slice(0, 5),
          history: history.slice(0, 5),
        };
      });

      return { profiles: groupedData, viewingData: viewingHistory || [] };
    },
    enabled: showPreviewDialog,
  });

  // Send weekly viewing report
  const handleSendWeeklyReport = async () => {
    setIsSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-viewing-report', {
        body: { manual: true }
      });
      
      if (error) throw error;
      toast.success(`Weekly report sent to ${data?.emailsSent || 0} parents!`);
      setShowPreviewDialog(false);
    } catch (error: any) {
      console.error('Error sending weekly report:', error);
      toast.error('Failed to send weekly report');
    } finally {
      setIsSendingReport(false);
    }
  };

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-kids-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all kids profiles
  const { data: kidsProfiles = [] } = useQuery({
    queryKey: ["admin-kids-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("is_kids", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch kids viewing history stats
  const { data: viewingStats = [] } = useQuery({
    queryKey: ["admin-kids-viewing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_viewing_history")
        .select(`
          profile_id,
          content_id,
          duration_watched_minutes,
          completed,
          watched_at,
          content:content_id(title, thumbnail_url)
        `)
        .order("watched_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch viewing trends for the chart (last 30 days)
  const { data: viewingTrends = [] } = useQuery({
    queryKey: ["admin-kids-viewing-trends"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("kids_viewing_history")
        .select("duration_watched_minutes, watched_at")
        .gte("watched_at", thirtyDaysAgo.toISOString())
        .order("watched_at", { ascending: true });
      
      if (error) throw error;
      
      // Group by date
      const grouped: Record<string, number> = {};
      data?.forEach((item) => {
        const date = new Date(item.watched_at).toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + (item.duration_watched_minutes || 0);
      });
      
      // Fill in missing dates with 0
      const result = [];
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        result.push({
          date: format(date, "MMM d"),
          minutes: grouped[dateStr] || 0,
        });
      }
      
      return result;
    },
  });

  // Fetch all kids content
  const { data: kidsContent = [] } = useQuery({
    queryKey: ["admin-kids-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_rating, content_type, view_count, age_limit")
        .in("content_rating", KIDS_RATINGS)
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`)
        .order("title");
      if (error) throw error;
      // Additional client-side filter for strict age compliance
      return (data || []).filter((item: any) => !item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT);
    },
  });

  // Fetch category mappings
  const { data: categoryMappings = [] } = useQuery({
    queryKey: ["admin-kids-category-mappings", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from("kids_content_categories")
        .select("content_id")
        .eq("category_id", selectedCategory);
      if (error) throw error;
      return data?.map((m) => m.content_id) || [];
    },
    enabled: !!selectedCategory,
  });

  // Create category
  const createMutation = useMutation({
    mutationFn: async (category: { name: string; emoji: string; color: string }) => {
      const slug = category.name.toLowerCase().replace(/\s+/g, "-");
      const maxOrder = Math.max(0, ...categories.map((c: any) => c.display_order || 0));
      
      const { error } = await supabase
        .from("kids_categories")
        .insert({
          name: category.name,
          slug,
          emoji: category.emoji,
          color: category.color,
          display_order: maxOrder + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      setShowAddDialog(false);
      setNewCategory({ name: "", emoji: "📚", color: "from-pink-500 to-rose-500" });
      toast.success("Category created!");
    },
  });

  // Update category
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("kids_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      toast.success("Category updated!");
    },
  });

  // Delete category
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kids_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      toast.success("Category deleted!");
    },
  });

  // Update kids profile settings
  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-profiles"] });
      toast.success("Profile updated!");
    },
  });

  // Reset watch time mutation
  const resetWatchTimeMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ 
          time_watched_today_minutes: 0,
          last_time_reset: new Date().toISOString().split('T')[0]
        })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-profiles"] });
      toast.success("Watch time reset!");
    },
    onError: () => {
      toast.error("Failed to reset watch time");
    },
  });

  // Toggle content in category
  const toggleContentMutation = useMutation({
    mutationFn: async ({ contentId, categoryId, add }: { contentId: string; categoryId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase
          .from("kids_content_categories")
          .insert({ content_id: contentId, category_id: categoryId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("kids_content_categories")
          .delete()
          .eq("content_id", contentId)
          .eq("category_id", categoryId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-category-mappings"] });
      toast.success("Content updated!");
    },
  });

  // Calculate stats
  const totalKidsProfiles = kidsProfiles.length;
  const totalKidsContent = kidsContent.length;
  const totalWatchMinutes = viewingStats.reduce((acc: number, v: any) => acc + (v.duration_watched_minutes || 0), 0);
  const avgWatchTimePerProfile = totalKidsProfiles > 0 ? Math.round(totalWatchMinutes / totalKidsProfiles) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
          <Baby className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Kids Zone Management</h2>
          <p className="text-muted-foreground">Manage kids profiles, content, and parental controls</p>
        </div>
      </div>

      {/* Admin Actions */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">Weekly Viewing Report</p>
                <p className="text-sm text-muted-foreground">Send a summary of kids' viewing activity to all parents</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowPreviewDialog(true)} 
                variant="outline"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button 
                onClick={handleSendWeeklyReport} 
                disabled={isSendingReport}
                className="gap-2"
              >
                {isSendingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSendingReport ? 'Sending...' : 'Send Now'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalKidsProfiles}</p>
                <p className="text-sm text-muted-foreground">Kids Profiles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalKidsContent}</p>
                <p className="text-sm text-muted-foreground">Kids Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWatchMinutes}</p>
                <p className="text-sm text-muted-foreground">Total Minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgWatchTimePerProfile}m</p>
                <p className="text-sm text-muted-foreground">Avg per Profile</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="youtube" className="flex items-center gap-2">
            <Youtube className="h-4 w-4" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kids Categories</h3>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Kids Category</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="e.g., Learn with Fun"
                    />
                  </div>
                  <div>
                    <Label>Emoji</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setNewCategory({ ...newCategory, emoji })}
                          className={`p-2 rounded-lg text-2xl ${
                            newCategory.emoji === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GRADIENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setNewCategory({ ...newCategory, color: opt.value })}
                          className={`w-12 h-8 rounded-lg bg-gradient-to-r ${opt.value} ${
                            newCategory.color === opt.value ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate(newCategory)}
                    disabled={!newCategory.name}
                  >
                    Create Category
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {categories.map((category: any) => (
              <Card key={category.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center text-2xl`}>
                        {category.emoji}
                      </div>
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">/{category.slug}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({
                            id: category.id,
                            updates: { is_active: checked },
                          });
                        }}
                      />
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setShowAssignDialog(true);
                        }}
                      >
                        <Tag className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(category.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {categories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No categories yet. Create one to get started!
              </div>
            )}
          </div>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <h3 className="text-lg font-semibold">Kids Profiles</h3>
          <div className="grid gap-4">
            {kidsProfiles.map((profile: any) => (
              <Card key={profile.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-xl">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          "👶"
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{profile.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Parent: {profile.profiles?.display_name || "Unknown"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={String(profile.daily_time_limit_minutes || 0)}
                          onValueChange={(value) => {
                            updateProfileMutation.mutate({
                              id: profile.id,
                              updates: { daily_time_limit_minutes: parseInt(value) || null },
                            });
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_LIMIT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={profile.bedtime_time || ""}
                          onChange={(e) => {
                            updateProfileMutation.mutate({
                              id: profile.id,
                              updates: { bedtime_time: e.target.value || null },
                            });
                          }}
                          className="w-28"
                        />
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {profile.time_watched_today_minutes || 0}m today
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetWatchTimeMutation.mutate(profile.id)}
                        disabled={resetWatchTimeMutation.isPending}
                        className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {kidsProfiles.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No kids profiles yet. Users can create them from the profile picker.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          <h3 className="text-lg font-semibold">Kids-Appropriate Content ({kidsContent.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {kidsContent.slice(0, 24).map((content: any) => (
              <div key={content.id} className="group relative">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={content.thumbnail_url || "/placeholder.svg"}
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium truncate">{content.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted">{content.content_rating}</span>
                    <span>{content.content_type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {kidsContent.length > 24 && (
            <p className="text-center text-muted-foreground">
              Showing 24 of {kidsContent.length} items
            </p>
          )}
        </TabsContent>

        {/* YouTube Tab */}
        <TabsContent value="youtube" className="space-y-4">
          <KidsYouTubeTab categories={categories} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          {/* Viewing Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Viewing Trends (Last 30 Days)
              </CardTitle>
              <CardDescription>
                Total minutes watched by all kids profiles over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {viewingTrends.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={viewingTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-muted-foreground"
                        tickFormatter={(value) => `${value}m`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`${value} minutes`, 'Watch Time']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="minutes" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorMinutes)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No viewing data available
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Viewing Activity</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const exportData = kidsProfiles.map((profile: any) => {
                    const profileStats = viewingStats.filter((s: any) => s.profile_id === profile.id);
                    const totalMinutes = profileStats.reduce((sum: number, s: any) => sum + (s.duration_watched_minutes || 0), 0);
                    const topContent = [...new Set(profileStats.map((s: any) => s.content?.title))].filter(Boolean).slice(0, 5);
                    
                    return {
                      profileName: profile.name,
                      parentName: profile.profiles?.display_name || "Unknown",
                      totalMinutes,
                      videosWatched: profileStats.length,
                      topContent: topContent as string[],
                      dailyLimit: profile.daily_time_limit_minutes,
                      bedtime: profile.bedtime_time,
                    };
                  });
                  exportToCSV(exportData, "kids_viewing_report");
                  toast.success("CSV exported successfully!");
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const exportData = kidsProfiles.map((profile: any) => {
                    const profileStats = viewingStats.filter((s: any) => s.profile_id === profile.id);
                    const totalMinutes = profileStats.reduce((sum: number, s: any) => sum + (s.duration_watched_minutes || 0), 0);
                    const topContent = [...new Set(profileStats.map((s: any) => s.content?.title))].filter(Boolean).slice(0, 5);
                    
                    return {
                      profileName: profile.name,
                      parentName: profile.profiles?.display_name || "Unknown",
                      totalMinutes,
                      videosWatched: profileStats.length,
                      topContent: topContent as string[],
                      dailyLimit: profile.daily_time_limit_minutes,
                      bedtime: profile.bedtime_time,
                    };
                  });
                  exportToPDF(exportData, "kids_viewing_report");
                }}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {viewingStats.slice(0, 20).map((stat: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={stat.content?.thumbnail_url || "/placeholder.svg"}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{stat.content?.title || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {stat.duration_watched_minutes}m watched
                        {stat.completed && <span className="text-green-500 ml-2">✓ Completed</span>}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.watched_at && format(new Date(stat.watched_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {viewingStats.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No viewing activity yet.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign Content Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign Content to {categories.find((c: any) => c.id === selectedCategory)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kidsContent.map((content: any) => {
              const isAssigned = categoryMappings.includes(content.id);
              return (
                <button
                  key={content.id}
                  onClick={() => {
                    if (selectedCategory) {
                      toggleContentMutation.mutate({
                        contentId: content.id,
                        categoryId: selectedCategory,
                        add: !isAssigned,
                      });
                    }
                  }}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    isAssigned ? "border-primary" : "border-transparent hover:border-muted"
                  }`}
                >
                  <img
                    src={content.thumbnail_url || "/placeholder.svg"}
                    alt={content.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                    <span className="text-white text-sm font-medium truncate">{content.title}</span>
                  </div>
                  {isAssigned && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Tag className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Report Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-500" />
              Weekly Viewing Report Preview
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reportPreview?.profiles?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Baby className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No kids profiles with viewing activity this week.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This is a preview of the weekly report that will be sent to parents. The report covers the last 7 days of viewing activity.
              </p>
              
              {reportPreview?.profiles?.map((item: any) => (
                <Card key={item.profile.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-xl flex-shrink-0">
                        👶
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-lg">{item.profile.name}</h4>
                        
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{item.totalMinutes}</p>
                            <p className="text-xs text-muted-foreground">Minutes Watched</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-500">{item.videosWatched}</p>
                            <p className="text-xs text-muted-foreground">Videos Watched</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-blue-500">{item.uniqueContent.length}</p>
                            <p className="text-xs text-muted-foreground">Unique Titles</p>
                          </div>
                        </div>
                        
                        {item.uniqueContent.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Top Content:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.uniqueContent.map((title: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                                  {title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Limit: {item.profile.daily_time_limit_minutes ? `${item.profile.daily_time_limit_minutes}m/day` : 'Unlimited'}
                          </span>
                          {item.profile.bedtime_time && (
                            <span className="flex items-center gap-1">
                              <Moon className="h-3 w-3" />
                              Bedtime: {item.profile.bedtime_time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendWeeklyReport} disabled={isSendingReport} className="gap-2">
                  {isSendingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSendingReport ? 'Sending...' : 'Send Report to Parents'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};