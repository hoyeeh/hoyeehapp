import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatorApplication, useSubmitCreatorApplication } from "@/hooks/useCreator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Film, Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";

export function CreatorApplicationForm() {
  const navigate = useNavigate();
  const { data: application } = useCreatorApplication();
  const submitApplication = useSubmitCreatorApplication();
  
  const [description, setDescription] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    
    await submitApplication.mutateAsync({
      description: description.trim(),
      portfolioUrl: portfolioUrl.trim() || undefined,
    });
  };

  // Application already exists
  if (application) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {application.status === 'pending' && (
              <>
                <Clock className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
                <CardTitle>Application Under Review</CardTitle>
                <CardDescription>
                  We're reviewing your creator application. You'll be notified once approved.
                </CardDescription>
              </>
            )}
            {application.status === 'rejected' && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                <CardTitle>Application Not Approved</CardTitle>
                <CardDescription>
                  {application.rejection_reason || "Your application was not approved at this time."}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <Film className="h-16 w-16 mx-auto text-primary mb-4" />
          <CardTitle>Become a Creator</CardTitle>
          <CardDescription>
            Apply to sell your movies and TV shows on our platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Tell us about yourself *</Label>
              <Textarea
                id="description"
                placeholder="Describe your experience creating content, what type of content you plan to upload, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="portfolio">Portfolio URL (optional)</Label>
              <Input
                id="portfolio"
                type="url"
                placeholder="https://your-portfolio.com"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={submitApplication.isPending} className="flex-1">
                {submitApplication.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Application
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
