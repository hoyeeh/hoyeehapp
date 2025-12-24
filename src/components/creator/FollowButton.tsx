import { Button } from "@/components/ui/button";
import { Heart, HeartOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsFollowing, useFollowCreator, useUnfollowCreator, useFollowerCount } from "@/hooks/useCreatorFollowers";
import { useNavigate } from "react-router-dom";

interface FollowButtonProps {
  creatorId: string;
  showCount?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
}

export function FollowButton({ 
  creatorId, 
  showCount = true, 
  size = "default",
  variant = "default" 
}: FollowButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: isFollowing, isLoading: checkingFollow } = useIsFollowing(creatorId);
  const { data: followerCount = 0 } = useFollowerCount(creatorId);
  const followMutation = useFollowCreator();
  const unfollowMutation = useUnfollowCreator();

  const isLoading = checkingFollow || followMutation.isPending || unfollowMutation.isPending;

  const handleClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isFollowing) {
      unfollowMutation.mutate(creatorId);
    } else {
      followMutation.mutate(creatorId);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <Button
      variant={isFollowing ? "outline" : variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <HeartOff className="h-4 w-4" />
      ) : (
        <Heart className="h-4 w-4" />
      )}
      {isFollowing ? "Following" : "Follow"}
      {showCount && followerCount > 0 && (
        <span className="text-xs opacity-70">({formatCount(followerCount)})</span>
      )}
    </Button>
  );
}
