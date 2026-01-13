import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { Sidebar } from "@/components/Sidebar";
import { UserDashboard } from "@/components/UserDashboard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { SecureVideoWrapper } from "@/components/security/SecureVideoWrapper";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { useState, useEffect } from "react";
import { Content } from "@/types";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handlePlay = async (content: Content) => {
    // Fetch full content details with video URL
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", content.id)
      .single();

    if (data && !error) {
      setPlayingContent({
        ...content,
        videoUrl: data.video_url || "",
      });
    }
  };

  const handleDetails = (content: Content) => {
    setSelectedContent(content);
  };

  if (!user) {
    return null;
  }

  if (playingContent && playingContent.videoUrl) {
    return (
      <SecureVideoWrapper>
        <VideoPlayer
          src={playingContent.videoUrl}
          title={playingContent.title}
          contentId={playingContent.id}
          onBack={() => setPlayingContent(null)}
        />
      </SecureVideoWrapper>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView="dashboard"
        onNavigate={(view) => {
          navigate(view === "home" ? "/" : `/${view}`);
        }}
        onLogout={handleLogout}
        userName={profile?.display_name || user.email?.split("@")[0]}
      />

      <main className="ml-16 md:ml-64">
        <UserDashboard onPlay={handlePlay} onDetails={handleDetails} />
      </main>

      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          onToggleList={() => {}}
          isInList={false}
        />
      )}
    </div>
  );
};

export default Dashboard;
