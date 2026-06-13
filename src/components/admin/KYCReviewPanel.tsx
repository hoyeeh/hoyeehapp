import { useState } from "react";
import { useAllKYCSubmissions, useReviewKYC } from "@/hooks/useCreatorKYC";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, CheckCircle, XCircle, Eye, Search, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export function KYCReviewPanel() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedKYC, setSelectedKYC] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: submissions = [], isLoading } = useAllKYCSubmissions(statusFilter);
  const reviewKYC = useReviewKYC();

  const filteredSubmissions = submissions.filter((sub: any) =>
    matchesSearch(search, sub.full_name, sub.creator_profiles?.display_name, sub.email)
  );

  const handleApprove = async (kyc: any) => {
    await reviewKYC.mutateAsync({
      kycId: kyc.id,
      creatorId: kyc.creator_id,
      status: 'approved',
    });
    setSelectedKYC(null);
  };

  const handleReject = async () => {
    if (!selectedKYC) return;
    await reviewKYC.mutateAsync({
      kycId: selectedKYC.id,
      creatorId: selectedKYC.creator_id,
      status: 'declined',
      rejectionReason,
    });
    setShowRejectDialog(false);
    setSelectedKYC(null);
    setRejectionReason("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getIdTypeLabel = (type: string) => {
    switch (type) {
      case 'national_id': return 'National ID';
      case 'drivers_license': return "Driver's License";
      case 'passport': return 'Passport';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KYC Verification Review
        </CardTitle>
        <CardDescription>
          Review and approve creator identity verification requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No KYC submissions found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>ID Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((kyc: any) => (
                <TableRow key={kyc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={kyc.creator_profiles?.avatar_url} />
                        <AvatarFallback>
                          {kyc.creator_profiles?.display_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{kyc.creator_profiles?.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{kyc.full_name}</TableCell>
                  <TableCell>{getIdTypeLabel(kyc.id_type)}</TableCell>
                  <TableCell>{format(new Date(kyc.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedKYC(kyc)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Review Dialog */}
        <Dialog open={!!selectedKYC && !showRejectDialog} onOpenChange={() => setSelectedKYC(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>KYC Review - {selectedKYC?.full_name}</DialogTitle>
            </DialogHeader>

            {selectedKYC && (
              <div className="space-y-6">
                {/* Personal Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedKYC.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{selectedKYC.date_of_birth || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedKYC.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedKYC.phone_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Nationality</Label>
                    <p className="font-medium">{selectedKYC.nationality || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">
                      {[selectedKYC.address_line1, selectedKYC.address_city, selectedKYC.address_country]
                        .filter(Boolean).join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* ID Document */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">ID Document</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm"><strong>Type:</strong> {getIdTypeLabel(selectedKYC.id_type)}</p>
                      <p className="text-sm"><strong>Number:</strong> {selectedKYC.id_number}</p>
                      <p className="text-sm"><strong>Expiry:</strong> {selectedKYC.id_expiry_date || 'N/A'}</p>
                    </div>
                    <div>
                      <a 
                        href={selectedKYC.id_document_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View ID Document
                      </a>
                    </div>
                  </div>
                </div>

                {selectedKYC.status === 'pending' && (
                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={reviewKYC.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedKYC)}
                      disabled={reviewKYC.isPending}
                    >
                      {reviewKYC.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </DialogFooter>
                )}

                {selectedKYC.status === 'declined' && selectedKYC.rejection_reason && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <Label className="text-destructive">Rejection Reason</Label>
                    <p className="text-sm">{selectedKYC.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline KYC</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for Decline *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this KYC is being declined..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason || reviewKYC.isPending}
              >
                {reviewKYC.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
