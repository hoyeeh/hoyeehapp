import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useAllUsers, useAllSubscriptions, useAdminContent, useDeleteContent } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit2, Tv } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { TVShowsList } from "@/components/admin/TVShowsList";
import { ContentUploadForm } from "@/components/admin/ContentUploadForm";
import { ContentEditForm } from "@/components/admin/ContentEditForm";
import { UserManagement } from "@/components/admin/UserManagement";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { SubscriptionManagement } from "@/components/admin/SubscriptionManagement";
import TVShowManagement from "@/components/admin/TVShowManagement";
import { TranscodingDashboard } from "@/components/admin/TranscodingDashboard";
import { GenreManagement } from "@/components/admin/GenreManagement";
import { Top10Management } from "@/components/admin/Top10Management";
import { HomeSectionManagement } from "@/components/admin/HomeSectionManagement";
import { EnhancedHomeSectionManagement } from "@/components/admin/EnhancedHomeSectionManagement";
import { ComingSoonManagement } from "@/components/admin/ComingSoonManagement";
import { HeroBannerManagement } from "@/components/admin/HeroBannerManagement";
import { AdminPushNotifications } from "@/components/admin/AdminPushNotifications";
import { AdminEmailSender } from "@/components/admin/AdminEmailSender";
import { BulkThumbnailRegeneration } from "@/components/admin/BulkThumbnailRegeneration";
import { BulkCastImport } from "@/components/admin/BulkCastImport";
import { UploadQueuePanel } from "@/components/admin/UploadQueuePanel";
import { CDNMigrationTool } from "@/components/admin/CDNMigrationTool";
import { SuperAdminDashboard } from "@/components/admin/SuperAdminDashboard";
import { KidsCategoryManagement } from "@/components/admin/KidsCategoryManagement";
import { AdminSubscriptionCredits } from "@/components/admin/AdminSubscriptionCredits";
import { AdminSupportChat } from "@/components/admin/AdminSupportChat";
import { AdminTicketAssignments } from "@/components/admin/AdminTicketAssignments";

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: users = [] } = useAllUsers();
  const { data: subscriptions = [] } = useAllSubscriptions();
  const { data: content = [] } = useAdminContent();
  const deleteContent = useDeleteContent();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [managingTVShow, setManagingTVShow] = useState<{ id: string; title: string; tmdbId?: number } | null>(null);

  const handleRefreshUsers = () => {
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
        <LoadingSpinner size="lg" text="Loading admin panel..." />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "superadmin":
        return <SuperAdminDashboard />;
      
      case "overview":
      
      case "content":
        return (
          <div className="space-y-6">
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

            {managingTVShow && (
              <TVShowManagement 
                contentId={managingTVShow.id}
                contentTitle={managingTVShow.title}
                tmdbId={managingTVShow.tmdbId}
                onClose={() => setManagingTVShow(null)}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {content.map((item) => (
                <Card key={item.id} className="bg-card overflow-hidden group">
                  <div className="relative aspect-[2/3]">
                    <img
                      src={item.thumbnail_url || "/placeholder.svg"}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    {item.content_type === "series" && (
                      <span className="absolute top-2 left-2 text-xs bg-primary/90 text-primary-foreground px-2 py-0.5 rounded">
                        TV Series
                      </span>
                    )}
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {item.content_type === "series" && (
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => setManagingTVShow({ 
                            id: item.id, 
                            title: item.title,
                            tmdbId: item.tmdb_id 
                          })}
                          title="Manage Seasons & Episodes"
                        >
                          <Tv className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => setEditingContent(item)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteContent(item.id, item.title)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.year} • {item.genre}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.view_count || 0} views
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      
      case "tvshows":
        return <TVShowsList content={content} onDelete={handleDeleteContent} />;
      
      case "upload":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Upload Content</h2>
            <UploadQueuePanel />
            <ContentUploadForm onClose={() => setActiveTab("content")} />
          </div>
        );
      
      case "users":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">User Management</h2>
            <AdminUserManagement users={users as any} onRefresh={handleRefreshUsers} />
          </div>
        );
      
      case "subscriptions":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Subscription Management</h2>
            <SubscriptionManagement users={users} subscriptions={subscriptions as any} />
            <AdminSubscriptionCredits />
          </div>
        );
      
      case "support":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Support Chat</h2>
            <AdminTicketAssignments />
            <AdminSupportChat />
          </div>
        );
      
      case "roles":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Role Management</h2>
            <UserManagement users={users} />
          </div>
        );
      
      case "notifications":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Notifications & Emails</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <AdminEmailSender />
              <AdminNotifications />
            </div>
          </div>
        );
      
      case "transcoding":
        return (
          <div className="space-y-6">
            <TranscodingDashboard />
            <BulkCastImport />
            <CDNMigrationTool />
            <BulkThumbnailRegeneration />
          </div>
        );
      
      case "genres":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Genre Management</h2>
            <GenreManagement />
          </div>
        );
      
      case "top10":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Top 10 Management</h2>
            <Top10Management />
          </div>
        );
      
      case "homepage":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Home Page Management</h2>
            <EnhancedHomeSectionManagement />
          </div>
        );
      
      case "push":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Push Notifications</h2>
            <AdminPushNotifications />
          </div>
        );
      
      case "comingsoon":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Coming Soon Management</h2>
            <ComingSoonManagement />
          </div>
        );
      
      case "banners":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Hero Banner Management</h2>
            <HeroBannerManagement />
          </div>
        );
      
      case "kids":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display">Kids Zone Management</h2>
            <KidsCategoryManagement />
          </div>
        );
      
      case "analytics":
        navigate("/analytics");
        return null;
      
      default:
        return <AdminOverview users={users} content={content} subscriptions={subscriptions} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Admin Sidebar */}
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 ml-16 md:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold capitalize">{activeTab}</h1>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 md:p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Admin;
