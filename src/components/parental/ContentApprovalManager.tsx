import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useKidsContentRestrictions,
  useSetContentRestriction,
  useRemoveContentRestriction,
} from "@/hooks/useKidsContentRestrictions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  X,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT } from "@/constants/kidsRatings";

interface ContentApprovalManagerProps {
  profileId: string;
  profileName: string;
}

export function ContentApprovalManager({
  profileId,
  profileName,
}: ContentApprovalManagerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "approved" | "blocked" | "none">("all");

  const { data: restrictions = [], isLoading: loadingRestrictions } =
    useKidsContentRestrictions(profileId);

  const setRestriction = useSetContentRestriction();
  const removeRestriction = useRemoveContentRestriction();

  // Fetch kids-appropriate content
  const { data: kidsContent = [], isLoading: loadingContent } = useQuery({
    queryKey: ["kids-content-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_type, content_rating, description")
        .in("content_rating", KIDS_RATINGS)
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`)
        .order("title");

      if (error) throw error;
      return (data || []).filter(
        (item: any) => !item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT
      );
    },
    enabled: !!user,
  });

  // Create a map of content restrictions
  const restrictionMap = new Map(
    restrictions.map((r: any) => [r.content_id, r.restriction_type])
  );

  // Filter content based on search and filter type
  const filteredContent = kidsContent.filter((content: any) => {
    const matchesSearch = content.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const restriction = restrictionMap.get(content.id);

    if (filterType === "approved") return matchesSearch && restriction === "approved";
    if (filterType === "blocked") return matchesSearch && restriction === "blocked";
    if (filterType === "none") return matchesSearch && !restriction;
    return matchesSearch;
  });

  const handleApprove = (contentId: string) => {
    setRestriction.mutate({
      profileId,
      contentId,
      restrictionType: "approved",
    });
  };

  const handleBlock = (contentId: string) => {
    setRestriction.mutate({
      profileId,
      contentId,
      restrictionType: "blocked",
    });
  };

  const handleRemove = (contentId: string) => {
    removeRestriction.mutate({ profileId, contentId });
  };

  const isLoading = loadingContent || loadingRestrictions;
  const isPending = setRestriction.isPending || removeRestriction.isPending;

  const approvedCount = restrictions.filter(
    (r: any) => r.restriction_type === "approved"
  ).length;
  const blockedCount = restrictions.filter(
    (r: any) => r.restriction_type === "blocked"
  ).length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Content Approval for {profileName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pre-approve or block specific content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {approvedCount} Approved
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
              <ShieldX className="w-3 h-3 mr-1" />
              {blockedCount} Blocked
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Content</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="none">No Restriction</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content List */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No content found matching your criteria
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContent.map((content: any) => {
                const restriction = restrictionMap.get(content.id);
                
                return (
                  <div
                    key={content.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                      restriction === "approved" && "bg-green-500/5 border-green-500/30",
                      restriction === "blocked" && "bg-red-500/5 border-red-500/30",
                      !restriction && "bg-muted/30 border-border/50"
                    )}
                  >
                    <img
                      src={content.thumbnail_url || "/placeholder.svg"}
                      alt={content.title}
                      className="w-16 h-10 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{content.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-1.5 py-0.5 bg-muted rounded">
                          {content.content_rating}
                        </span>
                        <span>{content.content_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {restriction === "approved" ? (
                        <>
                          <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemove(content.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : restriction === "blocked" ? (
                        <>
                          <Badge className="bg-red-500/20 text-red-600 hover:bg-red-500/30">
                            <ShieldX className="w-3 h-3 mr-1" />
                            Blocked
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemove(content.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-green-600 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => handleApprove(content.id)}
                            disabled={isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-600 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleBlock(content.id)}
                            disabled={isPending}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Block
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
