import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsCreator, useCreatorProfile, useCreatorContent, useCreatorSales, useCreatorPayouts, usePlatformSettings } from "@/hooks/useCreator";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { Sidebar } from "@/components/Sidebar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { 
  DollarSign, TrendingUp, Film, Users, ArrowLeft, 
  Wallet, CheckCircle, Clock, XCircle,
  BarChart3, Heart, Upload, Shield
} from "lucide-react";
import { format } from "date-fns";
import { CreatorApplicationForm } from "@/components/creator/CreatorApplicationForm";
import { CreatorContentManager } from "@/components/creator/CreatorContentManager";
import { CreatorPayoutForm } from "@/components/creator/CreatorPayoutForm";
import { AnalyticsDashboard } from "@/components/creator/AnalyticsDashboard";
import { FollowersList } from "@/components/creator/FollowersList";
import { TipsHistory } from "@/components/creator/TipsHistory";
import { CreatorContentUploadForm } from "@/components/creator/CreatorContentUploadForm";
import { KYCVerificationForm } from "@/components/creator/KYCVerificationForm";
import { KYCStatusBanner } from "@/components/creator/KYCStatusBanner";

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobile = isMobileDevice || isTablet;

  const { data: isCreator, isLoading: checkingCreator } = useIsCreator();
  const { data: creatorProfile, isLoading: loadingProfile } = useCreatorProfile();
  const { data: creatorContent = [] } = useCreatorContent();
  const { data: sales = [] } = useCreatorSales();
  const { data: payouts = [] } = useCreatorPayouts();
  const { data: platformSettings } = usePlatformSettings();

  const [activeTab, setActiveTab] = useState("overview");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (checkingCreator || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Film className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Sign in to access</h2>
          <p className="text-muted-foreground">Create an account to become a creator</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  // Not a creator yet - show application form
  if (!isCreator) {
    return <CreatorApplicationForm />;
  }

  // Calculate stats
  const totalEarnings = creatorProfile?.total_earnings || 0;
  const pendingBalance = creatorProfile?.pending_balance || 0;
  const totalWithdrawn = creatorProfile?.total_withdrawn || 0;
  const totalSales = sales.length;
  const totalContent = creatorContent.length;
  const followerCount = creatorProfile?.follower_count || 0;
  const totalTips = creatorProfile?.total_tips_received || 0;

  // Recent sales
  const recentSales = sales.slice(0, 5);

  const DashboardContent = () => (
    <div className="space-y-4 md:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              <span className="truncate">Total Earnings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold truncate">{formatCurrency(totalEarnings)}</p>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <Wallet className="h-3 w-3 md:h-4 md:w-4" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold text-green-500 truncate">{formatCurrency(pendingBalance)}</p>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
              Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold">{totalSales}</p>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <Film className="h-3 w-3 md:h-4 md:w-4" />
              Content
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold">{totalContent}</p>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              Followers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold">{followerCount}</p>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-0 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 md:gap-2">
              <Heart className="h-3 w-3 md:h-4 md:w-4" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0 pt-1">
            <p className="text-base md:text-xl font-bold truncate">{formatCurrency(totalTips)}</p>
          </CardContent>
        </Card>
      </div>

      {/* KYC Status Banner */}
      <KYCStatusBanner onOpenKYC={() => setActiveTab("kyc")} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-9 gap-1">
            <TabsTrigger value="overview" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="upload" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Upload className="h-3 w-3 mr-1 md:hidden" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="content" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Film className="h-3 w-3 mr-1 md:hidden" />
              Content
            </TabsTrigger>
            <TabsTrigger value="analytics" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <BarChart3 className="h-3 w-3 mr-1 md:hidden" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="sales" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 mr-1 md:hidden" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="followers" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Users className="h-3 w-3 mr-1 md:hidden" />
              Followers
            </TabsTrigger>
            <TabsTrigger value="tips" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Heart className="h-3 w-3 mr-1 md:hidden" />
              Tips
            </TabsTrigger>
            <TabsTrigger value="payouts" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Wallet className="h-3 w-3 mr-1 md:hidden" />
              Payouts
            </TabsTrigger>
            <TabsTrigger value="kyc" className="whitespace-nowrap px-3 py-2 text-xs md:text-sm">
              <Shield className="h-3 w-3 mr-1 md:hidden" />
              KYC
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Sales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                {recentSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentSales.map((sale: any) => (
                      <div key={sale.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{sale.content?.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          +{formatCurrency(sale.creator_share)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Earnings Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Earnings Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Earnings</span>
                    <span className="font-medium">{formatCurrency(totalEarnings)}</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Withdrawn</span>
                    <span className="font-medium">{formatCurrency(totalWithdrawn)}</span>
                  </div>
                  <Progress 
                    value={totalEarnings > 0 ? (totalWithdrawn / totalEarnings) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-500">Available</span>
                    <span className="font-medium text-green-500">{formatCurrency(pendingBalance)}</span>
                  </div>
                  <Progress 
                    value={totalEarnings > 0 ? (pendingBalance / totalEarnings) * 100 : 0} 
                    className="h-2 bg-green-100 [&>div]:bg-green-500" 
                  />
                </div>

                <div className="pt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full" disabled={pendingBalance < 5000}>
                        <Wallet className="h-4 w-4 mr-2" />
                        Request Payout
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <CreatorPayoutForm 
                        availableBalance={pendingBalance} 
                        creatorProfile={creatorProfile}
                      />
                    </DialogContent>
                  </Dialog>
                  {pendingBalance < 5000 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Minimum payout: {formatCurrency(5000)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Commission Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {platformSettings?.creator_commission_percent || 70}%
                  </p>
                  <p className="text-sm text-muted-foreground">Your Share</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-muted-foreground">
                    {platformSettings?.platform_commission_percent || 30}%
                  </p>
                  <p className="text-sm text-muted-foreground">Platform Fee</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <CreatorContentUploadForm />
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          <CreatorContentManager creatorProfile={creatorProfile} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {creatorProfile && <AnalyticsDashboard creatorId={creatorProfile.id} />}
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
              <CardDescription>All your content sales</CardDescription>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No sales yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Your Share</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.content?.title}</TableCell>
                        <TableCell>{format(new Date(sale.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{formatCurrency(sale.amount)}</TableCell>
                        <TableCell className="text-green-500">
                          +{formatCurrency(sale.creator_share)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                            {sale.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Followers Tab */}
        <TabsContent value="followers">
          {creatorProfile && <FollowersList creatorId={creatorProfile.id} />}
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips">
          {creatorProfile && <TipsHistory creatorId={creatorProfile.id} />}
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>Your withdrawal requests</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button disabled={pendingBalance < 5000}>
                    <Wallet className="h-4 w-4 mr-2" />
                    Request Payout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <CreatorPayoutForm 
                    availableBalance={pendingBalance} 
                    creatorProfile={creatorProfile}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No payout requests yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout: any) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          {format(new Date(payout.requested_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{payout.payout_method}</TableCell>
                        <TableCell>
                          <Badge variant={
                            payout.status === 'completed' ? 'default' :
                            payout.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {payout.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {payout.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {payout.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                            {payout.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Tab */}
        <TabsContent value="kyc">
          <KYCVerificationForm />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b safe-area-top">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate">Creator Studio</h1>
            </div>
            {creatorProfile?.is_verified && (
              <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="pt-14 px-3 pb-4">
          <DashboardContent />
        </main>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView="home"
        onNavigate={() => {}}
        onLogout={() => {}}
        userName=""
      />

      <main className="ml-16 md:ml-64 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                Creator Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your content, track sales, and request payouts
              </p>
            </div>
            {creatorProfile?.is_verified && (
              <Badge className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Verified Creator
              </Badge>
            )}
          </div>

          <DashboardContent />
        </div>
      </main>
    </div>
  );
}