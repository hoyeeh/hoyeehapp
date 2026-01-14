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
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Trash2,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT } from "@/constants/kidsRatings";
import { motion } from "framer-motion";

interface MobileContentApprovalProps {
  profileId: string;
  profileName: string;
  onBack: () => void;
}

export function MobileContentApproval({
  profileId,
  profileName,
  onBack,
}: MobileContentApprovalProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "approved" | "blocked">("all");

  const { data: restrictions = [], isLoading: loadingRestrictions } =
    useKidsContentRestrictions(profileId);

  const setRestriction = useSetContentRestriction();
  const removeRestriction = useRemoveContentRestriction();

  const { data: kidsContent = [], isLoading: loadingContent } = useQuery({
    queryKey: ["kids-content-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_type, content_rating")
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

  const restrictionMap = new Map(
    restrictions.map((r: any) => [r.content_id, r.restriction_type])
  );

  const filteredContent = kidsContent.filter((content: any) => {
    const matchesSearch = content.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const restriction = restrictionMap.get(content.id);

    if (filterType === "approved") return matchesSearch && restriction === "approved";
    if (filterType === "blocked") return matchesSearch && restriction === "blocked";
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
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14 pt-safe">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Content Approval</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pt-20 pb-6 px-4 overflow-y-auto h-full">
        {/* Stats */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <ShieldCheck className="w-3 h-3 mr-1" />
            {approvedCount} Approved
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <ShieldX className="w-3 h-3 mr-1" />
            {blockedCount} Blocked
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", "approved", "blocked"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                filterType === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No content found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredContent.map((content: any) => {
              const restriction = restrictionMap.get(content.id);

              return (
                <motion.div
                  key={content.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    restriction === "approved" && "bg-green-500/5 border-green-500/30",
                    restriction === "blocked" && "bg-red-500/5 border-red-500/30",
                    !restriction && "bg-muted/30 border-border/50"
                  )}
                >
                  <img
                    src={content.thumbnail_url || "/placeholder.svg"}
                    alt={content.title}
                    className="w-14 h-9 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{content.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {content.content_rating} • {content.content_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {restriction ? (
                      <>
                        {restriction === "approved" ? (
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <ShieldX className="w-4 h-4 text-red-500" />
                        )}
                        <button
                          onClick={() => handleRemove(content.id)}
                          disabled={isPending}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/50"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(content.id)}
                          disabled={isPending}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500/10 hover:bg-green-500/20"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                          onClick={() => handleBlock(content.id)}
                          disabled={isPending}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </motion.div>
  );
}
