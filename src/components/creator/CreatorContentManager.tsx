import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Film, Edit, Trash2, Eye, DollarSign, 
  ExternalLink, MoreVertical, Youtube, Download 
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useCreatorContent, useCreatorPaidContent, useCreatePaidContent, useUpdatePaidContent, useDeletePaidContent } from "@/hooks/useCreator";
import { format } from "date-fns";
import { toast } from "sonner";
import { YouTubeImportModal } from "./YouTubeImportModal";

interface CreatorContentManagerProps {
  creatorProfile: any;
}

export function CreatorContentManager({ creatorProfile }: CreatorContentManagerProps) {
  const { data: creatorContent = [], isLoading: loadingContent } = useCreatorContent();
  const { data: paidContent = [], isLoading: loadingPaid } = useCreatorPaidContent();
  const createPaidMutation = useCreatePaidContent();
  const updatePaidMutation = useUpdatePaidContent();
  const deletePaidMutation = useDeletePaidContent();

  const [showYouTubeImport, setShowYouTubeImport] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaidInfo = (contentId: string) => {
    return paidContent.find((p: any) => p.content_id === contentId);
  };

  const handleSetPrice = (content: any) => {
    const existing = getPaidInfo(content.id);
    setSelectedContent(content);
    setPrice(existing?.price?.toString() || "");
    setIsActive(existing?.is_active ?? true);
    setShowPriceDialog(true);
  };

  const handleSavePrice = async () => {
    if (!selectedContent || !price) return;

    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 100) {
      toast.error("Minimum price is 100 XAF");
      return;
    }

    const existing = getPaidInfo(selectedContent.id);

    try {
      if (existing) {
        await updatePaidMutation.mutateAsync({
          id: existing.id,
          price: priceNum,
          is_active: isActive,
        });
      } else {
        await createPaidMutation.mutateAsync({
          content_id: selectedContent.id,
          creator_id: creatorProfile.id,
          price: priceNum,
          is_active: isActive,
        });
      }
      setShowPriceDialog(false);
      toast.success("Price updated successfully");
    } catch (error) {
      toast.error("Failed to update price");
    }
  };

  const handleRemovePricing = async (contentId: string) => {
    const existing = getPaidInfo(contentId);
    if (!existing) return;

    try {
      await deletePaidMutation.mutateAsync(existing.id);
      toast.success("Pricing removed - content is now free");
    } catch (error) {
      toast.error("Failed to remove pricing");
    }
  };

  const isLoading = loadingContent || loadingPaid;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your Content</CardTitle>
            <CardDescription>Manage your content and pricing</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowYouTubeImport(true)}>
              <Youtube className="h-4 w-4 mr-2" />
              Import from YouTube
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Content
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Loading content...</div>
          ) : creatorContent.length === 0 ? (
            <div className="text-center py-12">
              <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No content yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload content or import from YouTube to get started
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setShowYouTubeImport(true)}>
                  <Youtube className="h-4 w-4 mr-2" />
                  Import from YouTube
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creatorContent.map((content: any) => {
                  const paidInfo = getPaidInfo(content.id);
                  return (
                    <TableRow key={content.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                            {content.thumbnail_url ? (
                              <img 
                                src={content.thumbnail_url} 
                                alt={content.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{content.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(content.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {content.content_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{content.view_count?.toLocaleString() || 0}</TableCell>
                      <TableCell>
                        {paidInfo ? (
                          <span className="font-medium text-primary">
                            {formatCurrency(paidInfo.price)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Free</span>
                        )}
                      </TableCell>
                      <TableCell>{paidInfo?.sale_count || 0}</TableCell>
                      <TableCell className="text-green-500">
                        {paidInfo ? formatCurrency(paidInfo.total_revenue) : '-'}
                      </TableCell>
                      <TableCell>
                        {paidInfo ? (
                          <Badge variant={paidInfo.is_active ? "default" : "secondary"}>
                            {paidInfo.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Free</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSetPrice(content)}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              {paidInfo ? 'Edit Price' : 'Set Price'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View in Studio
                            </DropdownMenuItem>
                            {paidInfo && (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleRemovePricing(content.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Pricing
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {getPaidInfo(selectedContent?.id) ? 'Edit Price' : 'Set Price'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Content</Label>
              <p className="font-medium">{selectedContent?.title}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (XAF)</Label>
              <Input
                id="price"
                type="number"
                placeholder="Enter price..."
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={100}
              />
              <p className="text-xs text-muted-foreground">Minimum: 100 XAF</p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active for sale</Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePrice}
              disabled={createPaidMutation.isPending || updatePaidMutation.isPending}
            >
              Save Price
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* YouTube Import Modal */}
      <YouTubeImportModal
        open={showYouTubeImport}
        onOpenChange={setShowYouTubeImport}
        creatorId={creatorProfile?.id}
      />
    </>
  );
}
