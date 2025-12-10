import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export const useVideoUploadSpaces = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (
    file: File,
    folder: string = 'episodes'
  ): Promise<{ fileKey: string; publicUrl: string } | null> => {
    setUploading(true);
    setProgress({ percent: 0, loaded: 0, total: file.size });
    setError(null);

    try {
      // Get presigned URL from edge function
      const { data: presignData, error: presignError } = await supabase.functions.invoke(
        'generate-upload-url',
        {
          body: {
            fileName: file.name,
            fileType: file.type,
            folder,
          },
        }
      );

      if (presignError || !presignData?.presignedUrl) {
        throw new Error(presignError?.message || 'Failed to get upload URL');
      }

      const { presignedUrl, fileKey, publicUrl } = presignData;

      // Upload file directly to DigitalOcean Spaces using presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress({
              percent,
              loaded: event.loaded,
              total: event.total,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setProgress({ percent: 100, loaded: file.size, total: file.size });
      return { fileKey, publicUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('Upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const resetProgress = () => {
    setProgress(null);
    setError(null);
  };

  return {
    uploadVideo,
    uploading,
    progress,
    error,
    resetProgress,
  };
};
