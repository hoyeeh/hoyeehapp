import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  RefreshCcw, 
  Download,
  Filter,
  Clock,
  User,
  Shield,
  Key,
  CreditCard,
  Mail,
  Upload,
  Edit,
  Trash2,
  Eye
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
}

interface AdminAuditLogViewerProps {
  onClose?: () => void;
}

const actionIcons: Record<string, typeof Shield> = {
  create: Upload,
  update: Edit,
  delete: Trash2,
  grant_credit: CreditCard,
  revoke_credit: CreditCard,
  promote_role: Shield,
  demote_role: Shield,
  remove_role: Shield,
  reset_pin: Key,
  reset_secret: Key,
  unlock_account: Key,
  toggle_subscription: CreditCard,
  send_notification: Mail,
  send_email: Mail,
};

const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-500",
  update: "bg-blue-500/10 text-blue-500",
  delete: "bg-red-500/10 text-red-500",
  grant_credit: "bg-emerald-500/10 text-emerald-500",
  revoke_credit: "bg-orange-500/10 text-orange-500",
  reset_pin: "bg-yellow-500/10 text-yellow-500",
  reset_secret: "bg-yellow-500/10 text-yellow-500",
  unlock_account: "bg-purple-500/10 text-purple-500",
  toggle_subscription: "bg-cyan-500/10 text-cyan-500",
  promote_role: "bg-indigo-500/10 text-indigo-500",
  demote_role: "bg-rose-500/10 text-rose-500",
};

export const AdminAuditLogViewer = ({ onClose }: AdminAuditLogViewerProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [adminNames, setAdminNames] = useState<Map<string, string>>(new Map());

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (resourceFilter !== "all") {
        query = query.eq("resource_type", resourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);

      // Fetch admin names
      const adminIds = [...new Set((data || []).map(log => log.admin_id))];
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", adminIds);

        const nameMap = new Map<string, string>();
        profiles?.forEach(p => {
          nameMap.set(p.id, p.display_name || "Unknown Admin");
        });
        setAdminNames(nameMap);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, resourceFilter]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const adminName = adminNames.get(log.admin_id) || "";
    return matchesSearch(
      searchQuery,
      log.action,
      log.resource_type,
      log.resource_id,
      adminName,
      JSON.stringify(log.details)
    );
  });

  const exportToCSV = () => {
    const headers = ["Date", "Admin", "Action", "Resource Type", "Resource ID", "Details"];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      adminNames.get(log.admin_id) || log.admin_id,
      log.action,
      log.resource_type,
      log.resource_id || "",
      JSON.stringify(log.details || {})
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueResources = [...new Set(logs.map(l => l.resource_type))];

  const getActionIcon = (action: string) => {
    const Icon = actionIcons[action] || Edit;
    return Icon;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Audit Log
            </CardTitle>
            <CardDescription>
              View all administrative actions and changes made to user accounts
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {action.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resourceFilter} onValueChange={setResourceFilter}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              {uniqueResources.map(resource => (
                <SelectItem key={resource} value={resource}>
                  {resource.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-secondary/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{filteredLogs.length}</p>
              <p className="text-xs text-muted-foreground">Total Logs</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-500">
                {filteredLogs.filter(l => l.action === "create").length}
              </p>
              <p className="text-xs text-muted-foreground">Creates</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">
                {filteredLogs.filter(l => l.action === "update").length}
              </p>
              <p className="text-xs text-muted-foreground">Updates</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-500">
                {filteredLogs.filter(l => l.action.includes("reset")).length}
              </p>
              <p className="text-xs text-muted-foreground">Resets</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary">
              <TableRow>
                <TableHead className="w-[180px]">Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead className="w-[80px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map(log => {
                  const ActionIcon = getActionIcon(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-secondary/50">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">
                              {format(new Date(log.created_at), "MMM d, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {adminNames.get(log.admin_id) || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`gap-1 ${actionColors[log.action] || "bg-secondary"}`}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {log.resource_type.replace(/_/g, " ")}
                          </p>
                          {log.resource_id && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {log.resource_id.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Details Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Audit Log Details
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Admin</p>
                    <p className="text-sm font-medium">
                      {adminNames.get(selectedLog.admin_id) || "Unknown"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Timestamp</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedLog.created_at), "MMM d, yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Action</p>
                    <Badge 
                      variant="outline" 
                      className={actionColors[selectedLog.action] || "bg-secondary"}
                    >
                      {selectedLog.action.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Resource Type</p>
                    <p className="text-sm font-medium capitalize">
                      {selectedLog.resource_type.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                
                {selectedLog.resource_id && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Resource ID</p>
                    <p className="text-sm font-mono bg-secondary p-2 rounded">
                      {selectedLog.resource_id}
                    </p>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">IP Address</p>
                    <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}

                {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details as object).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Details</p>
                    <pre className="text-xs bg-secondary p-3 rounded overflow-auto max-h-48">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
