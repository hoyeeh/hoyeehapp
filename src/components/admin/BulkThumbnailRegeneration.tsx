import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, getCompressionStats } from "@/utils/imageCompression";
import { toast } from "sonner";
import { RefreshCw, ImageIcon, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useVideoUploadSpaces } from "@/hooks/useVideoUploadSpaces";

interface ContentWithThumbnail {
  id: string;
  title: string;
  thumbnail_url: string | null;
}

interface RegenerationResult {
  id: string;
  title: string;
  status: 'success' | 'failed' | 'skipped';
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

export const BulkThumbnailRegeneration = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState<string>("");
  const [results, setResults] = useState<RegenerationResult[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const { uploadVideo } = useVideoUploadSpaces();

  const fetchImageAsFile = async (url: string, filename: string): Promise<File | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.error('Failed to fetch image:', error);
      return null;
    }
  };

  const processContent = async (content: ContentWithThumbnail): Promise<RegenerationResult> => {
    if (!content.thumbnail_url) {
      return { id: content.id, title: content.title, status: 'skipped', error: 'No thumbnail' };
    }

    // Skip if already WebP
    if (content.thumbnail_url.toLowerCase().endsWith('.webp')) {
      return { id: content.id, title: content.title, status: 'skipped', error: 'Already WebP' };
    }

    try {
      setCurrentItem(content.title);

      // Fetch the original image
      const originalFile = await fetchImageAsFile(
        content.thumbnail_url,
        `${content.id}-thumbnail`
      );

      if (!originalFile) {
        return { id: content.id, title: content.title, status: 'failed', error: 'Failed to fetch image' };
      }

      const originalSize = originalFile.size;

      // Compress to WebP
      const compressedFile = await compressImage(originalFile, {
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.85,
        mimeType: 'image/webp'
      });

      const compressedSize = compressedFile.size;

      // Upload to DO Spaces
      const result = await uploadVideo(compressedFile, 'thumbnails');

      if (!result) {
        return { id: content.id, title: content.title, status: 'failed', error: 'Upload failed' };
      }

      // Update database
      const { error: updateError } = await supabase
        .from('content')
        .update({ thumbnail_url: result.publicUrl })
        .eq('id', content.id);

      if (updateError) {
        return { id: content.id, title: content.title, status: 'failed', error: updateError.message };
      }

      return {
        id: content.id,
        title: content.title,
        status: 'success',
        originalSize,
        compressedSize
      };
    } catch (error) {
      return {
        id: content.id,
        title: content.title,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const startRegeneration = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      // Fetch all content with thumbnails
      const { data: contentList, error } = await supabase
        .from('content')
        .select('id, title, thumbnail_url')
        .not('thumbnail_url', 'is', null);

      if (error) throw error;

      if (!contentList || contentList.length === 0) {
        toast.info('No content with thumbnails found');
        setIsProcessing(false);
        return;
      }

      setTotalItems(contentList.length);
      const processedResults: RegenerationResult[] = [];

      for (let i = 0; i < contentList.length; i++) {
        const content = contentList[i];
        const result = await processContent(content);
        processedResults.push(result);
        setResults([...processedResults]);
        setProgress(((i + 1) / contentList.length) * 100);
      }

      const successCount = processedResults.filter(r => r.status === 'success').length;
      const failedCount = processedResults.filter(r => r.status === 'failed').length;
      const skippedCount = processedResults.filter(r => r.status === 'skipped').length;

      const totalSaved = processedResults
        .filter(r => r.status === 'success' && r.originalSize && r.compressedSize)
        .reduce((acc, r) => acc + ((r.originalSize || 0) - (r.compressedSize || 0)), 0);

      toast.success(
        `Completed: ${successCount} converted, ${skippedCount} skipped, ${failedCount} failed. Saved ${(totalSaved / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (error) {
      console.error('Regeneration error:', error);
      toast.error('Failed to start regeneration');
    } finally {
      setIsProcessing(false);
      setCurrentItem("");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const successResults = results.filter(r => r.status === 'success');
  const totalOriginalSize = successResults.reduce((acc, r) => acc + (r.originalSize || 0), 0);
  const totalCompressedSize = successResults.reduce((acc, r) => acc + (r.compressedSize || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Bulk Thumbnail Regeneration
        </CardTitle>
        <CardDescription>
          Recompress all existing thumbnails to WebP format to reduce storage costs and improve loading speed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={startRegeneration}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Bulk Regeneration
            </>
          )}
        </Button>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processing: {currentItem}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            {successResults.length > 0 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm font-medium text-green-500">
                  Total Savings: {formatBytes(totalOriginalSize - totalCompressedSize)} 
                  ({getCompressionStats(totalOriginalSize, totalCompressedSize).percentage}% reduction)
                </p>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {result.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                    {result.status === 'skipped' && <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                    <span className="truncate max-w-[200px]">{result.title}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {result.status === 'success' && result.originalSize && result.compressedSize
                      ? `${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)}`
                      : result.error || result.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
