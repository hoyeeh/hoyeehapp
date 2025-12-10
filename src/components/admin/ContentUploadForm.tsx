import { useState } from "react";
import { useCreateContent } from "@/hooks/useAdmin";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, X, Upload } from "lucide-react";

interface ContentUploadFormProps {
  onClose: () => void;
}

export const ContentUploadForm = ({ onClose }: ContentUploadFormProps) => {
  const createContent = useCreateContent();
  const { uploadVideo, uploadThumbnail, uploading, error: uploadError } = useVideoUpload();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
    content_type: "movie",
    year: new Date().getFullYear(),
    rating: "",
    is_premium: false,
    duration: 0,
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      let videoUrl = "";
      let thumbnailUrl = "";

      if (videoFile) {
        const url = await uploadVideo(videoFile, formData.title);
        if (url) videoUrl = url;
      }

      if (thumbnailFile) {
        const url = await uploadThumbnail(thumbnailFile, formData.title);
        if (url) thumbnailUrl = url;
      }

      await createContent.mutateAsync({
        ...formData,
        video_url: videoUrl || undefined,
        thumbnail_url: thumbnailUrl || undefined,
      });

      toast.success("Content created successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to create content");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add New Content</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter title"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.content_type} onValueChange={(v) => setFormData({ ...formData, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">Movie</SelectItem>
                  <SelectItem value="series">TV Series</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Genre</Label>
              <Input value={formData.genre} onChange={(e) => setFormData({ ...formData, genre: e.target.value })} placeholder="Drama, Action..." />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Label>Premium Content</Label>
            <Switch checked={formData.is_premium} onCheckedChange={(v) => setFormData({ ...formData, is_premium: v })} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Video File (max 2GB)</Label>
              <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || uploading}>
              {(submitting || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Content
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};