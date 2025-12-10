import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useAllUsers, useAllSubscriptions, useAdminContent, useDeleteContent } from "@/hooks/useAdmin";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Users, Film, CreditCard, Shield, Plus, Trash2, Edit2 } from "lucide-react";
import { ContentUploadForm } from "@/components/admin/ContentUploadForm";
import { ContentEditForm } from "@/components/admin/ContentEditForm";
import { UserManagement } from "@/components/admin/UserManagement";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { SubscriptionManagement } from "@/components/admin/SubscriptionManagement";

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: users = [] } = useAllUsers();
  const { data: subscriptions = [] } = useAllSubscriptions();
  const { data: content = [] } = useAdminContent();
  const deleteContent = useDeleteContent();
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);

  const handleRefreshUsers = () => {
    // Trigger refetch through query invalidation
    window.location.reload();
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && isAdmin === false) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

  const handleDeleteContent = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    
    try {
      await deleteContent.mutateAsync(id);
      toast.success("Content deleted successfully");
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const activeSubscriptions = subscriptions.filter(s => s.status === "active").length;
  const totalRevenue = subscriptions
    .filter(s => s.status === "active")
    .reduce((acc, s) => acc + Number(s.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
          <span className="text-muted-foreground">/ Admin</span>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{users.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Active Subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeSubscriptions}</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                Total Content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{content.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Monthly Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalRevenue.toLocaleString()} XAF</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="content" className="space-y-4">
          <TabsList className="bg-card">
            <TabsTrigger value="content" className="gap-2">
              <Film className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Roles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display">Content Management</h2>
              <Button onClick={() => setShowUploadForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </div>

            {showUploadForm && (
              <ContentUploadForm onClose={() => setShowUploadForm(false)} />
            )}

            {editingContent && (
              <ContentEditForm content={editingContent} onClose={() => setEditingContent(null)} />
            )}

            <div className="grid gap-4">
              {content.map((item) => (
                <Card key={item.id} className="bg-card">
                  <CardContent className="p-4 flex items-center gap-4">
                    <img
                      src={item.thumbnail_url || "/placeholder.svg"}
                      alt={item.title}
                      className="w-20 h-28 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.content_type} • {item.year} • {item.genre}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.is_premium ? "Premium" : "Free"} • {item.view_count || 0} views
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingContent(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteContent(item.id, item.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <h2 className="text-2xl font-display">User Management</h2>
            <AdminUserManagement users={users as any} onRefresh={handleRefreshUsers} />
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <h2 className="text-2xl font-display">Subscription Management</h2>
            <SubscriptionManagement users={users} subscriptions={subscriptions as any} />
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <h2 className="text-2xl font-display">Role Management</h2>
            <UserManagement users={users} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;