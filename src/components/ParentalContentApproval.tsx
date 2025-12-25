import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useKidsApprovedContent, useKidsProfileRequiresApproval } from "@/hooks/useKidsApprovedContent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Plus, X, Search, Check } from "lucide-react";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isKidsAllowedGenre } from "@/constants/kidsRatings";

interface ParentalContentApprovalProps {
  profileId: string;
  profileName: string;
}

export const ParentalContentApproval = ({ profileId, profileName }: ParentalContentApprovalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { approvedContent, approveContent, removeApproval, isContentApproved } = useKidsApprovedContent(profileId);
  const { requiresApproval, toggleRequiresApproval } = useKidsProfileRequiresApproval(profileId);

  // Get all kids-appropriate content for approval selection
  const { data: availableContent = [] } = useQuery({
    queryKey: ["kids-content-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, genre, content_rating, content_type, age_limit")
        .in("content_rating", KIDS_RATINGS)
        .order("title");

      if (error) throw error;

      return (data || []).filter((item: any) => 
        (!item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT) &&
        isKidsAllowedGenre(item.genre)
      );
    },
  });

  const filteredContent = availableContent.filter((item: any) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = (contentId: string) => {
    approveContent.mutate({ contentId });
  };

  const handleRemove = (contentId: string) => {
    removeApproval.mutate(contentId);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white/[0.02] border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Require Parent Approval</h3>
              <p className="text-sm text-white/50">
                {profileName} will only see content you've approved
              </p>
            </div>
          </div>
          <Switch
            checked={requiresApproval}
            onCheckedChange={(checked) => toggleRequiresApproval.mutate(checked)}
          />
        </div>
      </Card>

      {requiresApproval && (
        <>
          {/* Approved Content */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Approved Content ({approvedContent.length})
            </h3>
            {approvedContent.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {approvedContent.map((item: any) => (
                  <div key={item.id} className="relative group">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.03]">
                      <img
                        src={item.content?.thumbnail_url || "/placeholder.svg"}
                        alt={item.content?.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => handleRemove(item.content_id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    <p className="mt-2 text-sm text-white font-medium truncate">
                      {item.content?.title}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="p-8 bg-white/[0.02] border-white/[0.06] text-center">
                <p className="text-white/50">No content approved yet</p>
                <p className="text-sm text-white/30 mt-1">Add content below to get started</p>
              </Card>
            )}
          </div>

          {/* Add Content */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Add Content</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search kids content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.03] border-white/[0.08]"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto">
              {filteredContent.slice(0, 20).map((item: any) => {
                const approved = isContentApproved(item.id);
                return (
                  <div
                    key={item.id}
                    className={`relative cursor-pointer group ${approved ? "opacity-50" : ""}`}
                    onClick={() => !approved && handleApprove(item.id)}
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.03]">
                      <img
                        src={item.thumbnail_url || "/placeholder.svg"}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {approved ? (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-violet-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <p className="mt-2 text-sm text-white font-medium truncate">
                      {item.title}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {item.content_rating}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};