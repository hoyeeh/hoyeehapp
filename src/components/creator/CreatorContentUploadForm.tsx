import { useState } from "react";
import { useSubmitContent, useUploadCreatorMedia } from "@/hooks/useCreatorContentSubmission";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Upload, Film, Image, DollarSign, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const AGE_GROUPS = [
  { value: 'G', label: 'G - General Audiences' },
  { value: 'PG', label: 'PG - Parental Guidance' },
  { value: 'PG-13', label: 'PG-13 - Parents Strongly Cautioned' },
  { value: 'R', label: 'R - Restricted' },
  { value: '18+', label: '18+ - Adults Only' },
];

interface CreatorContentUploadFormProps {
  onSuccess?: () => void;
}

export function CreatorContentUploadForm({ onSuccess }: CreatorContentUploadFormProps) {
  const [open, setOpen] = useState(false);
  const submitContent = useSubmitContent();
  const uploadMedia = useUploadCreatorMedia();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    content_type: 'movie',
    age_group: 'PG',
    release_date: '',
    price_per_view: 0,
    video_url: '',
    cover_image_url: '',
    poster_image_url: '',
    duration: 0,
  });

  const [uploadProgress, setUploadProgress] = useState({
    video: 0,
    cover: 0,
    poster: 0,
  });

  const [uploading, setUploading] = useState({
    video: false,
    cover: false,
    poster: false,
  });

  // Fetch genres
  const { data: genres = [] } = useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'video' | 'cover' | 'poster'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    setUploadProgress(prev => ({ ...prev, [type]: 10 }));

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: Math.min(prev[type] + 10, 90)
        }));
      }, 500);

      const url = await uploadMedia.mutateAsync({ file, type });
      
      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [type]: 100 }));

      const urlField = type === 'video' ? 'video_url' : 
                       type === 'cover' ? 'cover_image_url' : 'poster_image_url';
      
      setFormData(prev => ({ ...prev, [urlField]: url }));

      // Extract duration for video
      if (type === 'video' && file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          setFormData(prev => ({ ...prev, duration: Math.round(video.duration) }));
          URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(file);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Trigger automatic French subtitle generation
  const triggerSubtitleGeneration = async (contentId: string, videoUrl: string) => {
    try {
      console.log('Triggering automatic French subtitle generation for:', contentId);
      await supabase.functions.invoke('generate-subtitles', {
        body: {
          contentId,
          audioUrl: videoUrl,
          languageCode: 'fra', // French by default
        },
      });
      console.log('Subtitle generation started successfully');
    } catch (error) {
      console.error('Failed to trigger subtitle generation:', error);
      // Don't block the upload on subtitle generation failure
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await submitContent.mutateAsync(formData);
    
    // Trigger automatic French subtitle generation if video was uploaded
    if (result?.id && formData.video_url) {
      triggerSubtitleGeneration(result.id, formData.video_url);
    }
    
    setOpen(false);
    onSuccess?.();
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      genre: '',
      content_type: 'movie',
      age_group: 'PG',
      release_date: '',
      price_per_view: 0,
      video_url: '',
      cover_image_url: '',
      poster_image_url: '',
      duration: 0,
    });
    setUploadProgress({ video: 0, cover: 0, poster: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Upload Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Upload New Content
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter content title"
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground">{formData.title.length}/100 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your content..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select 
                  value={formData.content_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, content_type: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="series">Series</SelectItem>
                    <SelectItem value="documentary">Documentary</SelectItem>
                    <SelectItem value="short">Short Film</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Genre</Label>
                <Select 
                  value={formData.genre} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                  <SelectContent>
                    {genres.map((genre: any) => (
                      <SelectItem key={genre.id} value={genre.name}>{genre.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Age Rating</Label>
                <Select 
                  value={formData.age_group} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, age_group: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((age) => (
                      <SelectItem key={age.value} value={age.value}>{age.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Release Date</Label>
                <Input
                  type="date"
                  value={formData.release_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, release_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Price Per View (XAF)
            </Label>
            <Input
              type="number"
              value={formData.price_per_view}
              onChange={(e) => setFormData(prev => ({ ...prev, price_per_view: parseFloat(e.target.value) || 0 }))}
              min={0}
              step={100}
              placeholder="0 for free content"
            />
            <p className="text-xs text-muted-foreground">Set to 0 for free content</p>
          </div>

          {/* Media Uploads */}
          <div className="space-y-4">
            <h4 className="font-medium">Media Files</h4>

            {/* Video Upload */}
            <div className="space-y-2">
              <Label>Video File *</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileUpload(e, 'video')}
                  disabled={uploading.video}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    {uploading.video ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <Progress value={uploadProgress.video} className="w-full max-w-xs" />
                      </>
                    ) : formData.video_url ? (
                      <>
                        <Film className="h-8 w-8 text-green-500" />
                        <span className="text-sm text-green-500">Video uploaded</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload video</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Image Uploads */}
            <div className="grid grid-cols-2 gap-4">
              {/* Cover Image */}
              <div className="space-y-2">
                <Label>Cover Image (Landscape)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center aspect-video flex items-center justify-center">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'cover')}
                    disabled={uploading.cover}
                    className="hidden"
                    id="cover-upload"
                  />
                  <label htmlFor="cover-upload" className="cursor-pointer w-full h-full flex items-center justify-center">
                    {uploading.cover ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : formData.cover_image_url ? (
                      <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Image className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Cover</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Poster Image */}
              <div className="space-y-2">
                <Label>Poster Image (Portrait)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center aspect-[2/3] flex items-center justify-center">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'poster')}
                    disabled={uploading.poster}
                    className="hidden"
                    id="poster-upload"
                  />
                  <label htmlFor="poster-upload" className="cursor-pointer w-full h-full flex items-center justify-center">
                    {uploading.poster ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : formData.poster_image_url ? (
                      <img src={formData.poster_image_url} alt="Poster" className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Image className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Poster</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={submitContent.isPending || !formData.title || !formData.video_url}
            className="w-full"
          >
            {submitContent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit for Review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
