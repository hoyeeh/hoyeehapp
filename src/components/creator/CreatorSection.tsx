import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsCreator, useCreatorProfile } from "@/hooks/useCreator";
import { useCreatorApplication } from "@/hooks/useCreator";
import { Film, BadgeCheck, Clock, XCircle, ArrowRight } from "lucide-react";

export const CreatorSection = () => {
  const navigate = useNavigate();
  const { data: isCreator, isLoading: checkingCreator } = useIsCreator();
  const { data: creatorProfile } = useCreatorProfile();
  const { data: application } = useCreatorApplication();

  if (checkingCreator) {
    return null;
  }

  // User is already a creator
  if (isCreator && creatorProfile) {
    return (
      <Card className="bg-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Creator Account
          </CardTitle>
          <CardDescription>Manage your creator dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium flex items-center gap-2">
                  {creatorProfile.display_name}
                  {creatorProfile.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-primary" />
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {creatorProfile.follower_count || 0} followers
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/creator-dashboard")}>
              Open Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User has pending application
  if (application?.status === 'pending') {
    return (
      <Card className="bg-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Creator Application
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="font-medium">Application Pending</p>
                <p className="text-sm text-muted-foreground">
                  Your creator application is being reviewed
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Pending
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User has rejected application
  if (application?.status === 'rejected') {
    return (
      <Card className="bg-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Creator Application
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">Application Rejected</p>
                <p className="text-sm text-muted-foreground">
                  {application.rejection_reason || "Your application was not approved at this time."}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/creator-dashboard")} variant="outline">
              Apply Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No application - show apply option
  return (
    <Card className="bg-card mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Become a Creator
        </CardTitle>
        <CardDescription>
          Share your content and earn money
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Create and sell your own content on our platform
            </p>
          </div>
          <Button onClick={() => navigate("/creator-dashboard")}>
            Apply Now
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};