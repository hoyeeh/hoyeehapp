import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, User } from "lucide-react";
import { useCreatorFollowers } from "@/hooks/useCreatorFollowers";
import { format } from "date-fns";

interface FollowersListProps {
  creatorId: string;
}

export function FollowersList({ creatorId }: FollowersListProps) {
  const { data: followers = [], isLoading } = useCreatorFollowers(creatorId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Followers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Followers ({followers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {followers.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No followers yet</p>
            <p className="text-sm text-muted-foreground">Share your profile to get followers!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {followers.map((follower: any) => (
                <div key={follower.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <Avatar>
                    <AvatarImage src={follower.profiles?.avatar_url} />
                    <AvatarFallback>
                      {follower.profiles?.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {follower.profiles?.display_name || 'Anonymous'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Followed {format(new Date(follower.followed_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
