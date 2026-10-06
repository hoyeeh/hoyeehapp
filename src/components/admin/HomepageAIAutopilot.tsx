import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bot, Globe, History, Loader2, RotateCcw, TrendingUp } from "lucide-react";

const TYPES = [
  { id: "content_swap", label: "Refresh row content" },
  { id: "heal", label: "Fix broken rows" },
];

interface Settings {
  id: string;
  autopilot_enabled: boolean;
  confidence_threshold: number;
  allowed_types: string[];
}

export function HomepageAIAutopilot() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["ai-homepage-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_homepage_settings" as any)
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Settings | null;
    },
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["external-trends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_trends" as any)
        .select("id,title,media_type,trend_rank,trend_window,vote_average,is_owned,genres")
        .order("trend_rank")
        .limit(80);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: changes = [] } = useQuery({
    queryKey: ["ai-homepage-change-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_homepage_change_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      if (!settings?.id) throw new Error("Settings not loaded");
      const { error } = await supabase
        .from("ai_homepage_settings" as any)
        .update(patch as any)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Autopilot settings saved");
      qc.invalidateQueries({ queryKey: ["ai-homepage-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncTrends = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("tmdb-trends-sync");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Trends refreshed — ${d?.inserted ?? 0} titles, ${d?.owned ?? 0} in your library`);
      qc.invalidateQueries({ queryKey: ["external-trends"] });
    },
    onError: (e: any) => toast.error(`Trend sync failed: ${e.message}`),
  });

  const revert = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("apply-homepage-suggestion", {
        body: { revert_change_log_id: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Change reverted");
      qc.invalidateQueries({ queryKey: ["ai-homepage-change-log"] });
      qc.invalidateQueries({ queryKey: ["home-sections"] });
    },
    onError: (e: any) => toast.error(`Revert failed: ${e.message}`),
  });

  const { data: layout } = useQuery({
    queryKey: ["homepage-layout-state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_layout_state" as any)
        .select("mode,switched_at")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const resetLayout = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("apply-homepage-suggestion", {
        body: { reset_to_default: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Homepage reset to your manual layout");
      qc.invalidateQueries({ queryKey: ["homepage-layout-state"] });
      qc.invalidateQueries({ queryKey: ["home-sections"] });
      qc.invalidateQueries({ queryKey: ["home-sections-display"] });
      qc.invalidateQueries({ queryKey: ["mobile-home-sections"] });
    },
    onError: (e: any) => toast.error(`Reset failed: ${e.message}`),
  });

  const allowed = settings?.allowed_types ?? [];
  const ownedCount = trends.filter((t) => t.is_owned).length;
  const mode = layout?.mode ?? "manual";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-brand" />
          Homepage Automation &amp; Global Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-border px-3 py-2">
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Live homepage</span>
              <Badge variant={mode === "ai" ? "default" : "secondary"}>
                Manual homepage
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your admin layout is always authoritative. Automation may refresh eligible row content, but cannot create or reorder rows.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resetLayout.mutate()}
            disabled={resetLayout.isPending || mode === "manual"}
          >
            {resetLayout.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <RotateCcw className="h-4 w-4 mr-2" />}
            Reset to default
          </Button>
        </div>

        <Tabs defaultValue="autopilot">
          <TabsList>
            <TabsTrigger value="autopilot">Autopilot</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="log">Change log</TabsTrigger>
          </TabsList>

          <TabsContent value="autopilot" className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Autopilot</Label>
                <p className="text-sm text-muted-foreground">
                   Apply high-confidence homepage content changes automatically after each review.
                </p>
              </div>
              <Switch
                checked={!!settings?.autopilot_enabled}
                onCheckedChange={(v) => saveSettings.mutate({ autopilot_enabled: v })}
              />
            </div>


            <div className="space-y-2">
              <Label>Confidence threshold: {settings?.confidence_threshold ?? 8}</Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[settings?.confidence_threshold ?? 8]}
                onValueChange={(v) => saveSettings.mutate({ confidence_threshold: v[0] })}
              />
              <p className="text-xs text-muted-foreground">
                Only suggestions at or above this priority are applied automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Allowed automatic actions</Label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={allowed.includes(t.id)}
                      onCheckedChange={(c) => {
                        const next = c
                          ? [...allowed, t.id]
                          : allowed.filter((a) => a !== t.id);
                        saveSettings.mutate({ allowed_types: next });
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {trends.length} trending titles · {ownedCount} in your library
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => syncTrends.mutate()} disabled={syncTrends.isPending}>
                {syncTrends.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Globe className="h-4 w-4 mr-2" />}
                Refresh trends
              </Button>
            </div>

            {trendsLoading && <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}

            <div className="max-h-96 overflow-y-auto divide-y divide-border rounded border border-border">
              {trends.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      #{t.trend_rank} {t.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.media_type} · {t.trend_window.replace("_", " ")} · ★ {Number(t.vote_average).toFixed(1)}
                      {t.genres?.length ? ` · ${t.genres.slice(0, 2).join(", ")}` : ""}
                    </div>
                  </div>
                  <Badge variant={t.is_owned ? "default" : "outline"}>
                    {t.is_owned ? "In library" : "Not owned"}
                  </Badge>
                </div>
              ))}
              {!trendsLoading && trends.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No trend data yet. Click <strong>Refresh trends</strong>.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="log" className="space-y-2 pt-4">
            {changes.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No automated changes applied yet.
              </div>
            )}
            {changes.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{String(c.suggestion_type).replace("_", " ")}</Badge>
                    {c.auto_applied && <Badge variant="outline">autopilot</Badge>}
                    {c.reverted_at && <Badge variant="destructive">reverted</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!c.reverted_at || revert.isPending}
                  onClick={() => revert.mutate(c.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Revert
                </Button>
              </div>
            ))}
            {changes.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <History className="h-3 w-3" /> Showing the 25 most recent changes.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
