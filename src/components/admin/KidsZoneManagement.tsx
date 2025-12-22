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
  Users, BarChart3, Eye, Calendar, Star, Shield, Mail, Send, Loader2
} from "lucide-react";
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
import { KIDS_RATINGS } from "@/constants/kidsRatings";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    emoji: "📚",
    color: "from-pink-500 to-rose-500",
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

  // Fetch all kids content
  const { data: kidsContent = [] } = useQuery({
    queryKey: ["admin-kids-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_rating, content_type, view_count")
        .in("content_rating", KIDS_RATINGS)
        .order("title");
      if (error) throw error;
      return data || [];
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
            <Button 
              onClick={handleSendWeeklyReport} 
              disabled={isSendingReport}
              variant="outline"
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
        <TabsList className="grid w-full grid-cols-4">
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

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Viewing Activity</h3>
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
    </div>
  );
};