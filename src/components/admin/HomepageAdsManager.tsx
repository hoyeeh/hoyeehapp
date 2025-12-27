import { useState } from 'react';
import { 
  useAllHomepageAds, 
  useDeleteHomepageAd, 
  useUpdateHomepageAd,
  HomepageAd 
} from '@/hooks/useHomepageAds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Pencil, Trash2, Pause, Play, Eye, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { HomepageAdForm } from './HomepageAdForm';
import { HomepageAdStats } from './HomepageAdStats';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-500/20 text-green-600',
  paused: 'bg-yellow-500/20 text-yellow-600',
  archived: 'bg-gray-500/20 text-gray-600',
};

export function HomepageAdsManager() {
  const { data: ads, isLoading } = useAllHomepageAds();
  const deleteAd = useDeleteHomepageAd();
  const updateAd = useUpdateHomepageAd();
  
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<HomepageAd | null>(null);
  const [viewingStats, setViewingStats] = useState<HomepageAd | null>(null);
  const [deletingAd, setDeletingAd] = useState<HomepageAd | null>(null);

  const handleEdit = (ad: HomepageAd) => {
    setEditingAd(ad);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingAd) return;
    
    try {
      await deleteAd.mutateAsync(deletingAd.id);
      toast.success('Ad deleted successfully');
      setDeletingAd(null);
    } catch (error) {
      toast.error('Failed to delete ad');
    }
  };

  const handleStatusChange = async (ad: HomepageAd, newStatus: string) => {
    try {
      await updateAd.mutateAsync({ 
        id: ad.id, 
        status: newStatus as HomepageAd['status'] 
      });
      toast.success(`Ad ${newStatus === 'active' ? 'activated' : newStatus}`);
    } catch (error) {
      toast.error('Failed to update ad status');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAd(null);
  };

  if (showForm) {
    return (
      <HomepageAdForm 
        ad={editingAd} 
        onClose={handleFormClose}
      />
    );
  }

  if (viewingStats) {
    return (
      <HomepageAdStats 
        ad={viewingStats} 
        onBack={() => setViewingStats(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Homepage Ads</h2>
          <p className="text-muted-foreground">Manage spotlight ads displayed on the homepage</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Ad
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading ads...</div>
          ) : !ads?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No ads created yet. Click "Create Ad" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Contexts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={ad.poster_url}
                          alt={ad.title}
                          className="w-16 h-9 object-cover rounded"
                        />
                        <div>
                          <div className="font-medium">{ad.title}</div>
                          {ad.subtitle && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {ad.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[ad.status]}>
                        {ad.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{ad.priority}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        (w:{ad.weight})
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {ad.start_at ? (
                          <div>From: {format(new Date(ad.start_at), 'MMM d, yyyy')}</div>
                        ) : (
                          <div className="text-muted-foreground">No start date</div>
                        )}
                        {ad.end_at ? (
                          <div>To: {format(new Date(ad.end_at), 'MMM d, yyyy')}</div>
                        ) : (
                          <div className="text-muted-foreground">No end date</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {ad.contexts?.main && (
                          <Badge variant="outline" className="text-xs">Main</Badge>
                        )}
                        {ad.contexts?.kids && (
                          <Badge variant="outline" className="text-xs">Kids</Badge>
                        )}
                        {ad.contexts?.tv && (
                          <Badge variant="outline" className="text-xs">TV</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingStats(ad)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Stats
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(ad)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {ad.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleStatusChange(ad, 'paused')}>
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          ) : ad.status !== 'archived' ? (
                            <DropdownMenuItem onClick={() => handleStatusChange(ad, 'active')}>
                              <Play className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          ) : null}
                          {ad.status !== 'archived' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(ad, 'archived')}>
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletingAd(ad)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAd} onOpenChange={() => setDeletingAd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ad?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingAd?.title}" and all its analytics data. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
