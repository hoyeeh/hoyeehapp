import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Eye,
  EyeOff,
  Calendar,
  RefreshCw,
  Sparkles,
  MoreHorizontal,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  useContentLifecycle,
  useLifecycleStats,
  useLifecycleLogs,
  useUpdateLifecycleStatus,
  useBulkUpdateLifecycle,
  useRunLifecycleCheck,
  useAIAnalysis,
  type LifecycleStatus,
  type ContentWithLifecycle,
} from "@/hooks/useContentLifecycle";
import { getLifecycleStatusColor, getLifecycleStatusLabel } from "@/components/LeavingSoonBadge";
import { cn } from "@/lib/utils";

export function LeavingSoonManagement() {
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [detailContent, setDetailContent] = useState<ContentWithLifecycle | null>(null);
  const [actionReason, setActionReason] = useState("");

  const statusFilter = selectedTab === "all" ? undefined : selectedTab as LifecycleStatus;
  const { data: content, isLoading } = useContentLifecycle(statusFilter);
  const { data: stats } = useLifecycleStats();
  const { data: logs } = useLifecycleLogs(detailContent?.id);
  const updateLifecycle = useUpdateLifecycleStatus();
  const bulkUpdate = useBulkUpdateLifecycle();
  const runCheck = useRunLifecycleCheck();
  const aiAnalysis = useAIAnalysis();

  const handleSelectAll = (checked: boolean) => {
    if (checked && content) {
      setSelectedItems(content.map((c) => c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, id]);
    } else {
      setSelectedItems((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleStatusChange = (contentId: string, status: LifecycleStatus) => {
    updateLifecycle.mutate({ contentId, status, reason: actionReason || `Manually set to ${status}` });
    setActionReason("");
  };

  const handleExtend = (contentId: string, days: number) => {
    updateLifecycle.mutate({ contentId, extendDays: days, reason: `Extended by ${days} days` });
  };

  const handleToggleOverride = (contentId: string, override: boolean) => {
    updateLifecycle.mutate({
      contentId,
      adminOverride: override,
      reason: override ? "Admin override enabled - AI will not auto-manage" : "Admin override disabled",
    });
  };

  const handleBulkAction = (action: "show" | "hide" | "extend30" | "extend60" | "extend90" | "overrideOn" | "overrideOff") => {
    if (selectedItems.length === 0) return;

    switch (action) {
      case "show":
        bulkUpdate.mutate({ contentIds: selectedItems, status: "active" });
        break;
      case "hide":
        bulkUpdate.mutate({ contentIds: selectedItems, status: "hidden" });
        break;
      case "extend30":
        bulkUpdate.mutate({ contentIds: selectedItems, extendDays: 30 });
        break;
      case "extend60":
        bulkUpdate.mutate({ contentIds: selectedItems, extendDays: 60 });
        break;
      case "extend90":
        bulkUpdate.mutate({ contentIds: selectedItems, extendDays: 90 });
        break;
      case "overrideOn":
        bulkUpdate.mutate({ contentIds: selectedItems, adminOverride: true });
        break;
      case "overrideOff":
        bulkUpdate.mutate({ contentIds: selectedItems, adminOverride: false });
        break;
    }
    setSelectedItems([]);
  };

  const handleRunAIAnalysis = async (contentId: string) => {
    const result = await aiAnalysis.mutateAsync({ contentId, action: "general_analysis" });
    if (result?.analysis) {
      setDetailContent((prev) => prev ? { ...prev, lifecycle_reason: JSON.stringify(result.analysis) } : null);
    }
  };

  const getDaysUntilExpiry = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const parseLifecycleReason = (reason: string | null): Record<string, unknown> | null => {
    if (!reason) return null;
    try {
      return JSON.parse(reason);
    } catch {
      return { raw: reason };
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats?.active || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leaving Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{stats?.leavingSoon || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hidden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{stats?.hidden || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kept</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats?.kept || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats?.total || 0}</span>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => runCheck.mutate()}
            disabled={runCheck.isPending}
          >
            {runCheck.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Lifecycle Check
          </Button>
        </div>
        {selectedItems.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">{selectedItems.length} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkAction("show")}>
                  <Eye className="h-4 w-4 mr-2" /> Show All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("hide")}>
                  <EyeOff className="h-4 w-4 mr-2" /> Hide All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("extend30")}>
                  <Calendar className="h-4 w-4 mr-2" /> Extend 30 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("extend60")}>
                  <Calendar className="h-4 w-4 mr-2" /> Extend 60 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("extend90")}>
                  <Calendar className="h-4 w-4 mr-2" /> Extend 90 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("overrideOn")}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Enable Override
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction("overrideOff")}>
                  <XCircle className="h-4 w-4 mr-2" /> Disable Override
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="leaving_soon">Leaving Soon</TabsTrigger>
              <TabsTrigger value="hidden">Hidden</TabsTrigger>
              <TabsTrigger value="kept">Kept</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={content?.length === selectedItems.length && content?.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Views (30d)</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {content?.map((item) => {
                    const daysLeft = getDaysUntilExpiry(item.expires_at);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.thumbnail_url && (
                              <img
                                src={item.thumbnail_url}
                                alt={item.title}
                                className="w-12 h-8 object-cover rounded"
                              />
                            )}
                            <span className="font-medium truncate max-w-[200px]">{item.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.content_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", getLifecycleStatusColor(item.lifecycle_status))}>
                            {getLifecycleStatusLabel(item.lifecycle_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {daysLeft !== null ? (
                            <span className={cn(
                              "font-medium",
                              daysLeft <= 7 ? "text-red-500" :
                              daysLeft <= 30 ? "text-orange-500" :
                              "text-muted-foreground"
                            )}>
                              {daysLeft} days
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span>{item.views_last_30_days}</span>
                            {item.views_last_30_days >= 50 && (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={item.admin_override}
                            onCheckedChange={(checked) => handleToggleOverride(item.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailContent(item)}>
                                <History className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(item.id, "active")}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Set Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(item.id, "hidden")}>
                                <EyeOff className="h-4 w-4 mr-2" /> Hide
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtend(item.id, 30)}>
                                <Calendar className="h-4 w-4 mr-2" /> Extend 30 Days
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtend(item.id, 90)}>
                                <Calendar className="h-4 w-4 mr-2" /> Extend 90 Days
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDetailContent(item);
                                  handleRunAIAnalysis(item.id);
                                }}
                              >
                                <Sparkles className="h-4 w-4 mr-2" /> AI Analysis
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailContent} onOpenChange={() => setDetailContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailContent?.title}</DialogTitle>
            <DialogDescription>Lifecycle details and history</DialogDescription>
          </DialogHeader>
          {detailContent && (
            <div className="space-y-6">
              {/* Status Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  <Badge className={cn("ml-2 border", getLifecycleStatusColor(detailContent.lifecycle_status))}>
                    {getLifecycleStatusLabel(detailContent.lifecycle_status)}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="ml-2">
                    {detailContent.expires_at
                      ? format(new Date(detailContent.expires_at), "PPP")
                      : "Not set"}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Views (30d)</span>
                  <span className="ml-2 font-medium">{detailContent.views_last_30_days}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Admin Override</span>
                  <span className="ml-2">{detailContent.admin_override ? "Yes" : "No"}</span>
                </div>
              </div>

              {/* AI Analysis */}
              {detailContent.lifecycle_reason && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Analysis
                  </h4>
                  <Card>
                    <CardContent className="pt-4">
                      {(() => {
                        const parsed = parseLifecycleReason(detailContent.lifecycle_reason);
                        if (!parsed) return <p className="text-muted-foreground">No analysis available</p>;

                        if (parsed.raw) {
                          return <p className="text-sm">{String(parsed.raw)}</p>;
                        }

                        return (
                          <div className="space-y-3 text-sm">
                            {parsed.recommendation && (
                              <div>
                                <span className="font-medium">Recommendation:</span>{" "}
                                <Badge variant="outline" className="capitalize">
                                  {String(parsed.recommendation)}
                                </Badge>
                                {parsed.confidence && (
                                  <span className="text-muted-foreground ml-2">
                                    ({String(parsed.confidence)}% confidence)
                                  </span>
                                )}
                              </div>
                            )}
                            {parsed.reasoning && (
                              <div>
                                <span className="font-medium">Reasoning:</span>{" "}
                                <span className="text-muted-foreground">{String(parsed.reasoning)}</span>
                              </div>
                            )}
                            {parsed.promotionIdeas && Array.isArray(parsed.promotionIdeas) && (
                              <div>
                                <span className="font-medium">Promotion Ideas:</span>
                                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                  {parsed.promotionIdeas.map((idea, i) => (
                                    <li key={i}>{String(idea)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {parsed.riskFactors && Array.isArray(parsed.riskFactors) && (
                              <div>
                                <span className="font-medium">Risk Factors:</span>
                                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                  {parsed.riskFactors.map((risk, i) => (
                                    <li key={i}>{String(risk)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Lifecycle History */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <History className="h-4 w-4" /> History
                </h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {logs?.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-2 rounded bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {log.previous_status || "new"} → {log.new_status}
                            </Badge>
                            <span className="text-muted-foreground">
                              by {log.changed_by}
                            </span>
                          </div>
                          {log.reason && (
                            <p className="text-sm text-muted-foreground mt-1">{log.reason}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    ))}
                    {(!logs || logs.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No history available
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleRunAIAnalysis(detailContent.id)}
                  disabled={aiAnalysis.isPending}
                >
                  {aiAnalysis.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Run AI Analysis
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExtend(detailContent.id, 30)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Extend 30 Days
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailContent(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
