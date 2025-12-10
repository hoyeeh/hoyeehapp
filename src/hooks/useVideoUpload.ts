import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const useVideoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File, contentTitle: string): Promise<string | null> => {
    if (!file) {
      setError("No file selected");
      return null;
    }

    // Check file size (2GB limit)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes
    if (file.size > maxSize) {
      setError("File size exceeds 2GB limit");
      return null;
    }

    // Check file type
    const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload MP4, WebM, OGG, or MOV");
      return null;
    }

    setUploading(true);
    setError(null);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedTitle = contentTitle.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const extension = file.name.split(".").pop();
      const fileName = `${sanitizedTitle}-${timestamp}.${extension}`;

      console.log("Uploading video:", fileName, "Size:", file.size);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(data.path);

      console.log("Video uploaded successfully:", urlData.publicUrl);
      setProgress({ loaded: file.size, total: file.size, percentage: 100 });

      return urlData.publicUrl;
    } catch (err: any) {
      console.error("Video upload failed:", err);
      setError(err.message || "Failed to upload video");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadThumbnail = async (file: File, contentTitle: string): Promise<string | null> => {
    if (!file) {
      setError("No file selected");
      return null;
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPG, PNG, or WebP");
      return null;
    }

    try {
      const timestamp = Date.now();
      const sanitizedTitle = contentTitle.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const extension = file.name.split(".").pop();
      const fileName = `thumbnails/${sanitizedTitle}-${timestamp}.${extension}`;

      const { data, error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error("Thumbnail upload failed:", err);
      setError(err.message || "Failed to upload thumbnail");
      return null;
    }
  };

  return {
    uploadVideo,
    uploadThumbnail,
    uploading,
    progress,
    error,
    clearError: () => setError(null),
  };
};