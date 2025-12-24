import { useState } from "react";
import { useAllContentSubmissions, useReviewContentSubmission } from "@/hooks/useCreatorContentSubmission";
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
import { Film, CheckCircle, XCircle, Eye, Search, Loader2, Play, DollarSign } from "lucide-react";
import { format } from "date-fns";

export function ContentSubmissionReview() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: submissions = [], isLoading } = useAllContentSubmissions(statusFilter);
  const reviewSubmission = useReviewContentSubmission();

  const filteredSubmissions = submissions.filter((sub: any) => 
    sub.title.toLowerCase().includes(search.toLowerCase()) ||
    sub.creator_profiles?.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleApprove = async (submission: any) => {
    await reviewSubmission.mutateAsync({
      submissionId: submission.id,
      creatorId: submission.creator_id,
      status: 'approved',
    });
    setSelectedSubmission(null);
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    await reviewSubmission.mutateAsync({
      submissionId: selectedSubmission.id,
      creatorId: selectedSubmission.creator_id,
      status: 'rejected',
      rejectionReason,
    });
    setShowRejectDialog(false);
    setSelectedSubmission(null);
    setRejectionReason("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Content Submission Review
        </CardTitle>
        <CardDescription>
          Review and approve creator content submissions
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
              placeholder="Search by title or creator..."
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
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No content submissions found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((sub: any) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {sub.poster_image_url ? (
                        <img 
                          src={sub.poster_image_url} 
                          alt={sub.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                          <Film className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{sub.title}</p>
                        <p className="text-sm text-muted-foreground">{sub.genre}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={sub.creator_profiles?.avatar_url} />
                        <AvatarFallback>
                          {sub.creator_profiles?.display_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{sub.creator_profiles?.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{sub.content_type}</TableCell>
                  <TableCell>
                    {sub.price_per_view > 0 ? formatCurrency(sub.price_per_view) : 'Free'}
                  </TableCell>
                  <TableCell>{format(new Date(sub.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubmission(sub)}
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
        <Dialog open={!!selectedSubmission && !showRejectDialog} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Content Review - {selectedSubmission?.title}</DialogTitle>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-6">
                {/* Preview Images */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedSubmission.cover_image_url && (
                    <div>
                      <Label className="text-muted-foreground">Cover Image</Label>
                      <img 
                        src={selectedSubmission.cover_image_url} 
                        alt="Cover"
                        className="w-full aspect-video object-cover rounded-lg mt-2"
                      />
                    </div>
                  )}
                  {selectedSubmission.poster_image_url && (
                    <div>
                      <Label className="text-muted-foreground">Poster Image</Label>
                      <img 
                        src={selectedSubmission.poster_image_url} 
                        alt="Poster"
                        className="w-full aspect-[2/3] object-cover rounded-lg mt-2"
                      />
                    </div>
                  )}
                </div>

                {/* Video Preview */}
                {selectedSubmission.video_url && (
                  <div>
                    <Label className="text-muted-foreground">Video Preview</Label>
                    <video 
                      src={selectedSubmission.video_url} 
                      controls
                      className="w-full rounded-lg mt-2"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{selectedSubmission.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium capitalize">{selectedSubmission.content_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Genre</Label>
                    <p className="font-medium">{selectedSubmission.genre || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Age Rating</Label>
                    <p className="font-medium">{selectedSubmission.age_group || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Price Per View</Label>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {selectedSubmission.price_per_view > 0 
                        ? formatCurrency(selectedSubmission.price_per_view) 
                        : 'Free'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Release Date</Label>
                    <p className="font-medium">
                      {selectedSubmission.release_date 
                        ? format(new Date(selectedSubmission.release_date), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm">{selectedSubmission.description || 'No description provided'}</p>
                  </div>
                </div>

                {selectedSubmission.status === 'pending' && (
                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={reviewSubmission.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedSubmission)}
                      disabled={reviewSubmission.isPending}
                    >
                      {reviewSubmission.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve & Publish
                    </Button>
                  </DialogFooter>
                )}

                {selectedSubmission.status === 'rejected' && selectedSubmission.rejection_reason && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <Label className="text-destructive">Rejection Reason</Label>
                    <p className="text-sm">{selectedSubmission.rejection_reason}</p>
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
              <DialogTitle>Reject Content</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for Rejection *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this content is being rejected..."
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
                disabled={!rejectionReason || reviewSubmission.isPending}
              >
                {reviewSubmission.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
