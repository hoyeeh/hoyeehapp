import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Check, X, Loader2, Wand2, Star } from "lucide-react";

interface Suggestion {
  id: string;
  suggestion_type: "heal" | "new_section" | "reorder" | "content_swap";
  target_section_id: string | null;
  proposed_payload: Record<string, any>;
  reason: string;
  priority: number;
  status: string;
  is_recommended?: boolean;
  created_at: string;
}

export function HomepageAISuggestions() {
  const qc = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["homepage-ai-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_ai_suggestions" as any)
        .select("*")
        .in("status", ["pending"])
        .order("is_recommended", { ascending: false })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data ?? []) as unknown as Suggestion[];
    },
  });

  const runAudit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-homepage-audit");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Audit complete — ${d?.inserted ?? 0} new suggestions`);
      qc.invalidateQueries({ queryKey: ["homepage-ai-suggestions"] });
    },
    onError: (e: any) => toast.error(`Audit failed: ${e.message}`),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("apply-homepage-suggestion", {
        body: { suggestion_id: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Suggestion applied");
      qc.invalidateQueries({ queryKey: ["homepage-ai-suggestions"] });
      qc.invalidateQueries({ queryKey: ["home-sections"] });
    },
    onError: (e: any) => toast.error(`Apply failed: ${e.message}`),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homepage_ai_suggestions" as any)
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["homepage-ai-suggestions"] });
    },
  });

  const typeColor = (t: string) =>
    t === "heal" ? "destructive" : t === "new_section" ? "default" : t === "reorder" ? "secondary" : "outline";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-semibold">AI Homepage Suggestions</h3>
          <Badge variant="secondary">{suggestions.length} of 2 pending</Badge>
        </div>
        <Button onClick={() => runAudit.mutate()} disabled={runAudit.isPending} size="sm">
          {runAudit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
          Run AI Audit
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!isLoading && suggestions.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No pending suggestions. Click <strong>Run AI Audit</strong> to scan your homepage now,
            or wait for the daily run. Each audit surfaces only the two strongest ideas.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {suggestions.map((s) => (
          <Card key={s.id} className={s.is_recommended ? "border-brand ring-1 ring-brand/40" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={typeColor(s.suggestion_type) as any}>
                    {s.suggestion_type.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">priority {s.priority}</Badge>
                  {s.is_recommended && (
                    <Badge className="gap-1">
                      <Star className="h-3 w-3" /> Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reject.mutate(s.id)} disabled={reject.isPending}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant={s.is_recommended ? "default" : "secondary"}
                    onClick={() => approve.mutate(s.id)}
                    disabled={approve.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" /> {s.is_recommended ? "Apply recommended" : "Approve & Apply"}
                  </Button>
                </div>
              </div>
              <CardTitle className="text-sm font-normal mt-2">{s.reason}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                {JSON.stringify(s.proposed_payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
