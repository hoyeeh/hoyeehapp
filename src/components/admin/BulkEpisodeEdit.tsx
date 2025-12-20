import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, X, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  duration: number;
  is_premium: boolean;
}

interface BulkEpisodeEditProps {
  episodes: Episode[];
  onComplete: () => void;
  onClose: () => void;
}

interface BulkUpdate {
  duration?: number;
  is_premium?: boolean;
  intro_start_time?: number;
  intro_end_time?: number;
}

export const BulkEpisodeEdit = ({ episodes, onComplete, onClose }: BulkEpisodeEditProps) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [bulkUpdate, setBulkUpdate] = useState<BulkUpdate>({});
  const [updateDuration, setUpdateDuration] = useState(false);
  const [updatePremium, setUpdatePremium] = useState(false);
  const [updateIntroTimes, setUpdateIntroTimes] = useState(false);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === episodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(episodes.map(ep => ep.id)));
    }
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "No episodes selected", variant: "destructive" });
      return;
    }

    const updates: Record<string, any> = {};
    if (updateDuration && bulkUpdate.duration !== undefined) {
      updates.duration = bulkUpdate.duration;
    }
    if (updatePremium && bulkUpdate.is_premium !== undefined) {
      updates.is_premium = bulkUpdate.is_premium;
    }
    if (updateIntroTimes) {
      if (bulkUpdate.intro_start_time !== undefined) {
        updates.intro_start_time = bulkUpdate.intro_start_time;
      }
      if (bulkUpdate.intro_end_time !== undefined) {
        updates.intro_end_time = bulkUpdate.intro_end_time;
      }
    }

    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes to apply", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        supabase.from('episodes').update(updates).eq('id', id)
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} episodes`);
      }

      toast({ 
        title: "Bulk Update Complete", 
        description: `Updated ${selectedIds.size} episodes` 
      });
      onComplete();
      onClose();
    } catch (error) {
      console.error('Bulk update error:', error);
      toast({ title: "Failed to update episodes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          Bulk Edit Episodes
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Episodes ({selectedIds.size} selected)</Label>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              {selectedIds.size === episodes.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
            {episodes.map(episode => (
              <label 
                key={episode.id}
                className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(episode.id)}
                  onCheckedChange={() => toggleSelect(episode.id)}
                />
                <span className="text-sm flex-1">
                  E{episode.episode_number}: {episode.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {episode.duration}min {episode.is_premium && '• Premium'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Bulk Update Fields */}
        <div className="space-y-4 border-t border-border pt-4">
          <Label className="text-sm font-medium">Apply Changes</Label>
          
          {/* Duration */}
          <div className="flex items-center gap-4">
            <Checkbox
              id="update-duration"
              checked={updateDuration}
              onCheckedChange={(checked) => setUpdateDuration(!!checked)}
            />
            <Label htmlFor="update-duration" className="flex-1">Set Duration (minutes)</Label>
            <Input
              type="number"
              disabled={!updateDuration}
              value={bulkUpdate.duration || ''}
              onChange={(e) => setBulkUpdate(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
              className="w-24"
              placeholder="45"
              min={0}
            />
          </div>

          {/* Premium */}
          <div className="flex items-center gap-4">
            <Checkbox
              id="update-premium"
              checked={updatePremium}
              onCheckedChange={(checked) => setUpdatePremium(!!checked)}
            />
            <Label htmlFor="update-premium" className="flex-1">Set Premium Status</Label>
            <Switch
              disabled={!updatePremium}
              checked={bulkUpdate.is_premium || false}
              onCheckedChange={(checked) => setBulkUpdate(prev => ({ ...prev, is_premium: checked }))}
            />
          </div>

          {/* Intro Skip Times */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-4">
              <Checkbox
                id="update-intro"
                checked={updateIntroTimes}
                onCheckedChange={(checked) => setUpdateIntroTimes(!!checked)}
              />
              <Label htmlFor="update-intro" className="flex-1">Set Intro Skip Times (seconds)</Label>
            </div>
            {updateIntroTimes && (
              <div className="grid grid-cols-2 gap-4 pl-8">
                <div>
                  <Label className="text-xs text-muted-foreground">Intro Start</Label>
                  <Input
                    type="number"
                    value={bulkUpdate.intro_start_time ?? ''}
                    onChange={(e) => setBulkUpdate(prev => ({ ...prev, intro_start_time: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Intro End</Label>
                  <Input
                    type="number"
                    value={bulkUpdate.intro_end_time ?? ''}
                    onChange={(e) => setBulkUpdate(prev => ({ ...prev, intro_end_time: parseInt(e.target.value) || 90 }))}
                    placeholder="90"
                    min={0}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || selectedIds.size === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update {selectedIds.size} Episodes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
