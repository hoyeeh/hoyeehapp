import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Film } from "lucide-react";

interface CreatorContentManagerProps {
  creatorProfile: any;
}

export function CreatorContentManager({ creatorProfile }: CreatorContentManagerProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Content</CardTitle>
          <CardDescription>Manage your paid content</CardDescription>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Content
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Content management coming soon</p>
          <p className="text-sm text-muted-foreground">Contact admin to upload content</p>
        </div>
      </CardContent>
    </Card>
  );
}
