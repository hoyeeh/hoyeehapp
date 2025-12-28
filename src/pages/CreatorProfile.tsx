import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorProfileById, useCreatorContent, useIsFollowingCreator, useToggleFollowCreator } from "@/hooks/usePaidContent";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PurchaseModal } from "@/components/creator/PurchaseModal";
import { EnhancedContentCard } from "@/components/creator-store/EnhancedContentCard";
import { ShareMenu } from "@/components/creator-store/ShareMenu";
import { CreatorImageUpload } from "@/components/creator-store/CreatorImageUpload";
import { 
  ArrowLeft, 
  CheckCircle, 
  Users, 
  Play, 
  ShoppingBag,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function CreatorProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { creatorId } = useParams<{ creatorId: string }>();
  const { user } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobile = isMobileDevice || isTablet;

  const [selectedContent, setSelectedContent] = useState<any>(null);

  const { data: creator, isLoading: creatorLoading } = useCreatorProfileById(creatorId || '');
  const { data: content = [], isLoading: contentLoading } = useCreatorContent(creatorId || '');
  const { data: isFollowing = false } = useIsFollowingCreator(creatorId || '');
  const toggleFollow = useToggleFollowCreator();
  
  // Check if current user is the owner of this creator profile
  const { data: userCreatorProfile } = useQuery({
    queryKey: ["user-creator-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("creator_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const isOwner = userCreatorProfile?.id === creatorId;

  const isLoading = creatorLoading || contentLoading;

  const handleFollow = () => {
    if (!user) {
      toast.error("Please sign in to follow creators");
      navigate('/auth');
      return;
    }
    if (!creatorId) return;
    toggleFollow.mutate({ creatorId, isFollowing });
  };

  const handleImageUploadComplete = () => {
    // Invalidate the creator profile query to refresh data
    queryClient.invalidateQueries({ queryKey: ["creator-profile", creatorId] });
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <Users className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Creator Not Found</h2>
          <p className="text-muted-foreground">This creator doesn't exist or is no longer active.</p>
          <Button onClick={() => navigate('/creator-store')}>
            Back to Hoyeeh Studio
          </Button>
        </div>
      </div>
    );
  }

  const totalSales = content.reduce((sum: number, item: any) => sum + (item.sale_count || 0), 0);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Cover Image */}
        <div className="relative h-48">
          {creator.cover_url ? (
            <img 
              src={creator.cover_url} 
              alt="" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Back Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 left-4 bg-background/50 backdrop-blur-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Share Button */}
          <ShareMenu
            title={creator?.display_name || "Creator"}
            text={`Check out ${creator?.display_name}'s content on Hoyeeh Studio`}
            className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm"
          />

          {/* Cover Upload Button - Only for owner */}
          {isOwner && (
            <CreatorImageUpload
              type="cover"
              currentUrl={creator.cover_url}
              creatorId={creatorId!}
              onUploadComplete={handleImageUploadComplete}
              className="absolute bottom-4 right-4"
            />
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 -mt-16 relative z-10">
          {/* Avatar */}
          <div className="flex items-end gap-4 mb-4">
            <div className="relative">
              {creator.avatar_url ? (
                <img 
                  src={creator.avatar_url} 
                  alt={creator.display_name}
                  className="w-24 h-24 rounded-full border-4 border-background object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-background bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">
                    {creator.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {creator.is_verified && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                  <CheckCircle className="h-6 w-6 text-primary fill-primary/20" />
                </div>
              )}
              {/* Avatar Upload Button - Only for owner */}
              {isOwner && (
                <CreatorImageUpload
                  type="avatar"
                  currentUrl={creator.avatar_url}
                  creatorId={creatorId!}
                  onUploadComplete={handleImageUploadComplete}
                />
              )}
            </div>
            
            {/* Follow Button - Not for owner */}
            {!isOwner && (
              <Button 
                onClick={handleFollow}
                disabled={toggleFollow.isPending}
                variant={isFollowing ? "outline" : "default"}
                className="flex-1"
              >
                {isFollowing ? (
                  <>
                    <Heart className="h-4 w-4 mr-2 fill-current" />
                    Following
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Name & Badges */}
          <div className="space-y-2 mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {creator.display_name}
              {creator.is_verified && (
                <Badge className="bg-primary/20 text-primary border-0">Verified</Badge>
              )}
            </h1>
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {formatCount(creator.follower_count || 0)} followers
              </span>
              <span className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                {content.length} videos
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                {formatCount(totalSales)} sales
              </span>
            </div>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-muted-foreground mb-6">{creator.bio}</p>
          )}

          {/* Content */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Content ({content.length})</h2>
            
            {content.length === 0 ? (
              <div className="text-center py-8 bg-card/30 rounded-xl">
                <Play className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No content available yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {content.map((item: any) => (
                  <EnhancedContentCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedContent(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <MobileBottomNav />

        {selectedContent && (
          <PurchaseModal
            open={!!selectedContent}
            onClose={() => setSelectedContent(null)}
            paidContent={selectedContent}
          />
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView="home"
        onNavigate={() => {}}
        onLogout={() => {}}
        userName=""
      />

      <main className="ml-16 md:ml-64">
        {/* Cover Image */}
        <div className="relative h-64 md:h-80">
          {creator.cover_url ? (
            <img 
              src={creator.cover_url} 
              alt="" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Back Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-6 left-6 bg-background/50 backdrop-blur-sm gap-2"
            onClick={() => navigate('/creator-store')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hoyeeh Studio
          </Button>

          {/* Cover Upload Button - Only for owner */}
          {isOwner && (
            <CreatorImageUpload
              type="cover"
              currentUrl={creator.cover_url}
              creatorId={creatorId!}
              onUploadComplete={handleImageUploadComplete}
              className="absolute top-6 right-6"
            />
          )}
        </div>

        {/* Profile Section */}
        <div className="px-6 lg:px-12 -mt-24 relative z-10 pb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Avatar */}
            <div className="relative">
              {creator.avatar_url ? (
                <img 
                  src={creator.avatar_url} 
                  alt={creator.display_name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-background object-cover shadow-xl"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-background bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-xl">
                  <span className="text-4xl font-bold text-primary">
                    {creator.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {creator.is_verified && (
                <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-lg">
                  <CheckCircle className="h-8 w-8 text-primary fill-primary/20" />
                </div>
              )}
              {/* Avatar Upload Button - Only for owner */}
              {isOwner && (
                <CreatorImageUpload
                  type="avatar"
                  currentUrl={creator.avatar_url}
                  creatorId={creatorId!}
                  onUploadComplete={handleImageUploadComplete}
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold">{creator.display_name}</h1>
                {creator.is_verified && (
                  <Badge className="bg-primary/20 text-primary border-0">Verified Creator</Badge>
                )}
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-6 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="font-semibold text-foreground">{formatCount(creator.follower_count || 0)}</span> followers
                </span>
                <span className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  <span className="font-semibold text-foreground">{content.length}</span> videos
                </span>
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="font-semibold text-foreground">{formatCount(totalSales)}</span> total sales
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!isOwner && (
                <Button 
                  onClick={handleFollow}
                  disabled={toggleFollow.isPending}
                  size="lg"
                  variant={isFollowing ? "outline" : "default"}
                  className="gap-2"
                >
                  {isFollowing ? (
                    <>
                      <Heart className="h-5 w-5 fill-current" />
                      Following
                    </>
                  ) : (
                    <>
                      <Heart className="h-5 w-5" />
                      Follow
                    </>
                  )}
                </Button>
              )}
              <ShareMenu
                title={creator?.display_name || "Creator"}
                text={`Check out ${creator?.display_name}'s content on Hoyeeh Studio`}
                variant="outline"
                size="lg"
              />
            </div>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-muted-foreground mt-6 max-w-3xl text-lg">{creator.bio}</p>
          )}
        </div>

        {/* Content Grid */}
        <div className="px-6 lg:px-12 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">All Content</h2>
            <span className="text-muted-foreground">{content.length} videos</span>
          </div>

          {content.length === 0 ? (
            <div className="text-center py-16 bg-card/30 rounded-2xl border border-border/50">
              <Play className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No content yet</h3>
              <p className="text-muted-foreground">This creator hasn't published any content yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {content.map((item: any) => (
                <EnhancedContentCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedContent(item)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedContent && (
        <PurchaseModal
          open={!!selectedContent}
          onClose={() => setSelectedContent(null)}
          paidContent={selectedContent}
        />
      )}
    </div>
  );
}