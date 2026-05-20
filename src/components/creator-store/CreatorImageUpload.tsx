import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreatorImageUploadProps {
  type: "avatar" | "cover";
  currentUrl?: string | null;
  creatorId: string;
  onUploadComplete: (url: string) => void;
  className?: string;
}

export function CreatorImageUpload({
  type,
  currentUrl,
  creatorId,
  onUploadComplete,
  className,
}: CreatorImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${type}/${creatorId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("creator-uploads")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (1 year expiry)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("creator-uploads")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      const imageUrl = urlData.signedUrl;

      // Update creator profile
      const updateField = type === "avatar" ? "avatar_url" : "cover_url";
      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({ [updateField]: imageUrl } as any)
        .eq("id", creatorId);

      if (updateError) throw updateError;

      onUploadComplete(imageUrl);
      toast.success(`${type === "avatar" ? "Profile" : "Cover"} image updated`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  if (type === "avatar") {
    return (
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />
      <Button
        variant="secondary"
        size="sm"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {currentUrl ? "Change Cover" : "Add Cover"}
          </>
        )}
      </Button>
    </div>
  );
}