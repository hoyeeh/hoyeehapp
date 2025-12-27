import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  HomepageAd, 
  useCreateHomepageAd, 
  useUpdateHomepageAd 
} from '@/hooks/useHomepageAds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
  priority: z.number().min(1).max(1000),
  weight: z.number().min(1).max(100),
  video_url: z.string().url().optional().or(z.literal('')),
  video_type: z.enum(['mp4', 'hls']).optional(),
  poster_url: z.string().url('Valid poster URL is required'),
  cta_label: z.string().optional(),
  cta_url: z.string().url().optional().or(z.literal('')),
  cta_internal_route: z.string().optional(),
  contexts_main: z.boolean(),
  contexts_kids: z.boolean(),
  contexts_tv: z.boolean(),
  kids_safe: z.boolean(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface HomepageAdFormProps {
  ad?: HomepageAd | null;
  onClose: () => void;
}

export function HomepageAdForm({ ad, onClose }: HomepageAdFormProps) {
  const createAd = useCreateHomepageAd();
  const updateAd = useUpdateHomepageAd();
  const isEditing = !!ad;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: ad?.title || '',
      subtitle: ad?.subtitle || '',
      status: ad?.status || 'draft',
      priority: ad?.priority || 100,
      weight: ad?.weight || 1,
      video_url: ad?.video_url || '',
      video_type: ad?.video_type || undefined,
      poster_url: ad?.poster_url || '',
      cta_label: ad?.cta_label || '',
      cta_url: ad?.cta_url || '',
      cta_internal_route: ad?.cta_internal_route || '',
      contexts_main: ad?.contexts?.main ?? true,
      contexts_kids: ad?.contexts?.kids ?? false,
      contexts_tv: ad?.contexts?.tv ?? false,
      kids_safe: ad?.kids_safe ?? false,
      start_at: ad?.start_at ? new Date(ad.start_at).toISOString().slice(0, 16) : '',
      end_at: ad?.end_at ? new Date(ad.end_at).toISOString().slice(0, 16) : '',
    },
  });

  const videoUrl = form.watch('video_url');

  // Auto-detect video type from URL
  const detectVideoType = (url: string): 'mp4' | 'hls' | undefined => {
    if (!url) return undefined;
    if (url.includes('.m3u8')) return 'hls';
    if (url.includes('.mp4')) return 'mp4';
    return undefined;
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const adData = {
        title: values.title,
        subtitle: values.subtitle || null,
        status: values.status,
        priority: values.priority,
        weight: values.weight,
        video_url: values.video_url || null,
        video_type: values.video_url ? (values.video_type || detectVideoType(values.video_url)) : null,
        poster_url: values.poster_url,
        cta_label: values.cta_label || null,
        cta_url: values.cta_url || null,
        cta_internal_route: values.cta_internal_route || null,
        contexts: {
          main: values.contexts_main,
          kids: values.contexts_kids,
          tv: values.contexts_tv,
        },
        targeting: null,
        kids_safe: values.kids_safe,
        start_at: values.start_at ? new Date(values.start_at).toISOString() : null,
        end_at: values.end_at ? new Date(values.end_at).toISOString() : null,
      };

      if (isEditing && ad) {
        await updateAd.mutateAsync({ id: ad.id, ...adData });
        toast.success('Ad updated successfully');
      } else {
        await createAd.mutateAsync(adData);
        toast.success('Ad created successfully');
      }
      
      onClose();
    } catch (error) {
      toast.error(isEditing ? 'Failed to update ad' : 'Failed to create ad');
    }
  };

  const isSubmitting = createAd.isPending || updateAd.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Edit Ad' : 'Create New Ad'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing ? 'Update the ad details below' : 'Fill in the details to create a new homepage ad'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ad title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtitle / Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description or tagline" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="poster_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poster Image URL *</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Required fallback image when video is not available
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="video_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (MP4 or HLS m3u8)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional video that auto-plays when in view
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {videoUrl && (
                <FormField
                  control={form.control}
                  name="video_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value || detectVideoType(videoUrl)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Auto-detect" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mp4">MP4</SelectItem>
                          <SelectItem value="hls">HLS (m3u8)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* CTA */}
          <Card>
            <CardHeader>
              <CardTitle>Call to Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="cta_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Button Label</FormLabel>
                    <FormControl>
                      <Input placeholder="Watch Now, Learn More, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cta_internal_route"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Route</FormLabel>
                    <FormControl>
                      <Input placeholder="/content/123 or /category/action" {...field} />
                    </FormControl>
                    <FormDescription>
                      For linking to pages within the app
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cta_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      For linking to external websites (opens in new tab)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Scheduling & Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduling & Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={1000}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date/Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>Leave empty for immediate start</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date/Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>Leave empty for no end date</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Targeting */}
          <Card>
            <CardHeader>
              <CardTitle>Targeting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">Show in Contexts</Label>
                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name="contexts_main"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Main App</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contexts_kids"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Kids App</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contexts_tv"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">TV Web</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="kids_safe"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Kids Safe</FormLabel>
                      <FormDescription>
                        Mark this ad as safe for kids profiles
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Ad' : 'Create Ad'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
