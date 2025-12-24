import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Gift, TrendingUp, DollarSign, Heart } from "lucide-react";
import { useCreatorTips, useTipStats } from "@/hooks/useCreatorTips";
import { format } from "date-fns";

export function TipsHistory() {
  const { data: tips = [], isLoading } = useCreatorTips();
  const { data: stats } = useTipStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Total Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalTips || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Tip Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.tipCount || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(stats?.thisMonthTips || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Average Tip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats?.averageTip || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tips Received</CardTitle>
          <CardDescription>All tips from your fans</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading tips...</div>
          ) : tips.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tips received yet</p>
              <p className="text-sm text-muted-foreground">Share your profile to start receiving tips!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tips.map((tip: any) => (
                  <TableRow key={tip.id}>
                    <TableCell>
                      {format(new Date(tip.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium text-green-500">
                      +{formatCurrency(tip.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {tip.message || <span className="text-muted-foreground">No message</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tip.status === 'completed' ? 'default' : 'secondary'}>
                        {tip.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
