import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3, Mail, CheckCircle, XCircle, Eye, MousePointer,
  RefreshCw, TrendingUp, Clock, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";

interface EmailLog {
  id: string;
  message_id: string | null;
  recipient_email: string;
  template_type: string;
  subject: string;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  bounce_reason: string | null;
}

interface EmailStats {
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  pending: number;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
  opened: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  clicked: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  bounced: "bg-red-500/20 text-red-400 border-red-500/30",
  complained: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const EmailDeliveryStats = () => {
  const [dateRange, setDateRange] = useState("7");
  const [templateFilter, setTemplateFilter] = useState("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["email-logs", dateRange, templateFilter],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
      
      let query = supabase
        .from("email_logs")
        .select("*")
        .gte("sent_at", startDate.toISOString())
        .order("sent_at", { ascending: false })
        .limit(100);

      if (templateFilter !== "all") {
        query = query.eq("template_type", templateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EmailLog[];
    },
  });

  const stats: EmailStats = logs.reduce(
    (acc, log) => {
      acc.total++;
      if (log.status === "delivered") acc.delivered++;
      else if (log.status === "opened") {
        acc.delivered++;
        acc.opened++;
      } else if (log.status === "clicked") {
        acc.delivered++;
        acc.opened++;
        acc.clicked++;
      } else if (log.status === "bounced") acc.bounced++;
      else acc.pending++;
      return acc;
    },
    { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, pending: 0 }
  );

  const deliveryRate = stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : "0";
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0";
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0";
  const bounceRate = stats.total > 0 ? ((stats.bounced / stats.total) * 100).toFixed(1) : "0";

  const templateTypes = [...new Set(logs.map((l) => l.template_type))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Email Delivery Stats</h2>
            <p className="text-muted-foreground">Track email delivery, opens, and bounces</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Template type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            {templateTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered ({deliveryRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Eye className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.opened}</p>
                <p className="text-xs text-muted-foreground">Opened ({openRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <MousePointer className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clicked}</p>
                <p className="text-xs text-muted-foreground">Clicked ({clickRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.bounced}</p>
                <p className="text-xs text-muted-foreground">Bounced ({bounceRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Emails</CardTitle>
          <CardDescription>Latest {logs.length} emails sent</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mb-2 opacity-50" />
              <p>No emails sent yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{log.subject}</p>
                        <Badge variant="outline" className={STATUS_COLORS[log.status] || ""}>
                          {log.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="truncate max-w-[200px]">{log.recipient_email}</span>
                        <span className="capitalize">{log.template_type.replace(/_/g, " ")}</span>
                        <span>{format(new Date(log.sent_at), "MMM d, h:mm a")}</span>
                      </div>
                      {log.bounce_reason && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="truncate">{log.bounce_reason}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {log.delivered_at && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-400" />
                        </div>
                      )}
                      {log.opened_at && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-purple-400" />
                        </div>
                      )}
                      {log.clicked_at && (
                        <div className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3 text-cyan-400" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
