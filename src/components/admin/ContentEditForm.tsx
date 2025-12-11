import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateContent } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Save, Loader2, Plus, Trash2, User } from "lucide-react";
import { VideoUploadField } from "./VideoUploadField";
import { ThumbnailUploadField } from "./ThumbnailUploadField";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  genre: string | null;
  content_type: string;
  is_premium: boolean | null;
  duration: number | null;
  year: number | null;
  rating: string | null;
  director?: string | null;
  cast_members?: CastMember[] | null;
}

interface ContentEditFormProps {
  content: ContentItem;
  onClose: () => void;
}

// Helper to parse cast_members
const parseCast = (castMembers: any): CastMember[] => {
  if (!castMembers) return [];
  if (Array.isArray(castMembers)) return castMembers;
  try {
    return typeof castMembers === 'string' ? JSON.parse(castMembers) : [];
  } catch {
    return [];
  }
};

export const ContentEditForm = ({ content, onClose }: ContentEditFormProps) => {
  const updateContent = useUpdateContent();
  const [formData, setFormData] = useState({
    title: content.title,
    description: content.description || "",
    thumbnail_url: content.thumbnail_url || "",
    video_url: content.video_url || "",
    genre: content.genre || "",
    content_type: content.content_type,
    is_premium: content.is_premium || false,
    duration: content.duration || 0,
    year: content.year || new Date().getFullYear(),
    rating: content.rating || "",
    director: content.director || "",
  });

  const [castMembers, setCastMembers] = useState<CastMember[]>(parseCast(content.cast_members));
  const [newCastName, setNewCastName] = useState("");
  const [newCastCharacter, setNewCastCharacter] = useState("");

  // Fetch genres from database
  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleAddCastMember = () => {
    if (!newCastName.trim()) {
      toast.error("Please enter cast member name");
      return;
    }
    const newMember: CastMember = {
      id: Date.now(),
      name: newCastName.trim(),
      character: newCastCharacter.trim(),
      profile_path: null,
    };
    setCastMembers([...castMembers, newMember]);
    setNewCastName("");
    setNewCastCharacter("");
  };

  const handleRemoveCastMember = (id: number) => {
    setCastMembers(castMembers.filter(m => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateContent.mutateAsync({
        id: content.id,
        ...formData,
        director: formData.director || null,
        cast_members: castMembers.length > 0 ? castMembers : null,
      });
      toast.success("Content updated successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to update content");
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Edit Content</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-secondary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select
                value={formData.content_type}
                onValueChange={(value) => setFormData({ ...formData, content_type: value })}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">Movie</SelectItem>
                  <SelectItem value="series">TV Series</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={formData.genre}
                onValueChange={(value) => setFormData({ ...formData, genre: value })}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((genre: any) => (
                    <SelectItem key={genre.id} value={genre.name}>{genre.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rating</Label>
              <Select
                value={formData.rating}
                onValueChange={(value) => setFormData({ ...formData, rating: value })}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="G">G</SelectItem>
                  <SelectItem value="PG">PG</SelectItem>
                  <SelectItem value="PG-13">PG-13</SelectItem>
                  <SelectItem value="R">R</SelectItem>
                  <SelectItem value="NC-17">NC-17</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                className="bg-secondary"
                min={1900}
                max={2100}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                className="bg-secondary"
                min={0}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Director</Label>
              <Input
                value={formData.director}
                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                className="bg-secondary"
                placeholder="Enter director name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-secondary min-h-24"
              rows={3}
            />
          </div>

          {/* Cast Members Section */}
          <div className="space-y-3 border border-border rounded-lg p-4">
            <Label className="text-base font-semibold">Cast Members</Label>
            
            {/* Existing Cast */}
            {castMembers.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {castMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      {member.profile_path ? (
                        <img src={member.profile_path} alt={member.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      {member.character && (
                        <p className="text-xs text-muted-foreground truncate">as {member.character}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveCastMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Cast */}
            <div className="flex gap-2">
              <Input
                value={newCastName}
                onChange={(e) => setNewCastName(e.target.value)}
                placeholder="Actor name"
                className="bg-secondary flex-1"
              />
              <Input
                value={newCastCharacter}
                onChange={(e) => setNewCastCharacter(e.target.value)}
                placeholder="Character"
                className="bg-secondary flex-1"
              />
              <Button type="button" variant="secondary" size="icon" onClick={handleAddCastMember}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Thumbnail Upload */}
          <ThumbnailUploadField
            value={formData.thumbnail_url}
            onChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
            label="Thumbnail"
            folder="thumbnails"
          />

          {/* Video Upload - Only show for movies */}
          {formData.content_type === "movie" && (
            <VideoUploadField
              value={formData.video_url}
              onChange={(url) => setFormData({ ...formData, video_url: url })}
              onDurationDetected={(duration) => setFormData({ ...formData, duration: Math.round(duration / 60) })}
              label="Video"
              folder="movies"
            />
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={formData.is_premium}
              onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
            />
            <Label>Premium Content</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={updateContent.isPending} className="gap-2">
              {updateContent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
