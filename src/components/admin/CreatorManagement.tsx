import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, DollarSign, Users, Film, TrendingUp, Settings, Loader2, BadgeCheck, Ban } from "lucide-react";
import { 
  useCreatorApplications, 
  useApproveCreatorApplication, 
  useRejectCreatorApplication,
  useAllCreators,
  useAllCreatorPayouts,
  useProcessPayout,
  useCreatorMarketplaceStats,
  usePlatformSettings,
  useUpdatePlatformSettings,
  useAdminUpdateCreator
} from "@/hooks/useCreatorAdmin";
import { format } from "date-fns";

export const CreatorManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const { data: stats, isLoading: statsLoading } = useCreatorMarketplaceStats();
  const { data: applications } = useCreatorApplications();
  const { data: creators } = useAllCreators();
  const { data: payouts } = useAllCreatorPayouts();
  const { data: platformSettings } = usePlatformSettings();
  
  const approveApplication = useApproveCreatorApplication();
  const rejectApplication = useRejectCreatorApplication();
  const processPayout = useProcessPayout();
  const updateSettings = useUpdatePlatformSettings();
  const updateCreator = useAdminUpdateCreator();

  const pendingApplications = applications?.filter(a => a.status === 'pending') || [];
  const pendingPayouts = payouts?.filter(p => p.status === 'pending') || [];

  const handleApprove = async (app: any) => {
    await approveApplication.mutateAsync({
      applicationId: app.id,
      userId: app.user_id,
      displayName: app.profiles?.display_name || 'Creator'
    });
  };

  const handleReject = async () => {
    await rejectApplication.mutateAsync({
      applicationId: rejectDialog.id,
      reason: rejectReason
    });
    setRejectDialog({ open: false, id: "" });
    setRejectReason("");
  };

  const handleProcessPayout = async (payoutId: string) => {
    await processPayout.mutateAsync(payoutId);
  };

  const handleSaveSettings = async () => {
    await updateSettings.mutateAsync(settingsForm);
    setSettingsDialog(false);
  };

  const openSettingsDialog = () => {
    setSettingsForm(platformSettings || {});
    setSettingsDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Creator Marketplace</h1>
        <Button onClick={openSettingsDialog} variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Commission Settings
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalCreators || 0}</p>
                <p className="text-sm text-muted-foreground">Active Creators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Film className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalPaidContent || 0}</p>
                <p className="text-sm text-muted-foreground">Paid Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalSales || 0}</p>
                <p className="text-sm text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{(stats?.platformRevenue || 0).toLocaleString()} XAF</p>
                <p className="text-sm text-muted-foreground">Platform Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alerts */}
      {(pendingApplications.length > 0 || pendingPayouts.length > 0) && (
        <div className="flex gap-4">
          {pendingApplications.length > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              {pendingApplications.length} pending application(s)
            </Badge>
          )}
          {pendingPayouts.length > 0 && (
            <Badge variant="secondary" className="text-sm py-1 px-3 bg-amber-500/20 text-amber-500">
              {pendingPayouts.length} pending payout(s) - {stats?.pendingPayoutAmount?.toLocaleString()} XAF
            </Badge>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Applications</TabsTrigger>
          <TabsTrigger value="creators">Creators</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Creator Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Portfolio</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications?.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>{app.profiles?.display_name || 'Unknown'}</TableCell>
                      <TableCell className="max-w-xs truncate">{app.description}</TableCell>
                      <TableCell>
                        {app.portfolio_url ? (
                          <a href={app.portfolio_url} target="_blank" className="text-primary hover:underline">View</a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{format(new Date(app.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={app.status === 'approved' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove(app)} disabled={approveApplication.isPending}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectDialog({ open: true, id: app.id })}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!applications?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">No applications</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creators" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Creators</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Pending Balance</TableHead>
                    <TableHead>Withdrawn</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creators?.map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell className="font-medium">{creator.display_name}</TableCell>
                      <TableCell>{Number(creator.total_earnings).toLocaleString()} XAF</TableCell>
                      <TableCell>{Number(creator.pending_balance).toLocaleString()} XAF</TableCell>
                      <TableCell>{Number(creator.total_withdrawn).toLocaleString()} XAF</TableCell>
                      <TableCell>
                        {creator.is_verified ? <BadgeCheck className="h-5 w-5 text-primary" /> : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={creator.is_active ? 'default' : 'destructive'}>
                          {creator.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateCreator.mutate({ creatorId: creator.id, updates: { is_verified: !creator.is_verified } })}
                          >
                            {creator.is_verified ? 'Unverify' : 'Verify'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant={creator.is_active ? 'destructive' : 'default'}
                            onClick={() => updateCreator.mutate({ creatorId: creator.id, updates: { is_active: !creator.is_active } })}
                          >
                            {creator.is_active ? <Ban className="h-4 w-4" /> : 'Enable'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts?.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>{payout.creator_profiles?.display_name}</TableCell>
                      <TableCell>{Number(payout.amount).toLocaleString()} {payout.currency}</TableCell>
                      <TableCell className="capitalize">{payout.payout_method.replace('_', ' ')}</TableCell>
                      <TableCell>{format(new Date(payout.requested_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          payout.status === 'completed' ? 'default' : 
                          payout.status === 'failed' ? 'destructive' : 
                          payout.status === 'processing' ? 'secondary' : 'outline'
                        }>
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payout.status === 'pending' && (
                          <Button size="sm" onClick={() => handleProcessPayout(payout.id)} disabled={processPayout.isPending}>
                            {processPayout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Process'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, id: rejectDialog.id })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "" })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectApplication.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commission Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Creator Commission (%)</label>
              <Input
                type="number"
                value={settingsForm['creator_commission_percent'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, creator_commission_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Platform Commission (%)</label>
              <Input
                type="number"
                value={settingsForm['platform_commission_percent'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, platform_commission_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Minimum Payout Amount (XAF)</label>
              <Input
                type="number"
                value={settingsForm['minimum_payout_amount'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, minimum_payout_amount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Minimum Content Price (XAF)</label>
              <Input
                type="number"
                value={settingsForm['minimum_content_price'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, minimum_content_price: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
