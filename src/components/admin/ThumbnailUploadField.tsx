import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useVideoUploadSpaces } from "@/hooks/useVideoUploadSpaces";
import { Upload, X, Check, Image, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage, getCompressionStats } from "@/utils/imageCompression";

interface ThumbnailUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
}

export const ThumbnailUploadField = ({ 
  value, 
  onChange,
  label = "Thumbnail",
  folder = "thumbnails"
}: ThumbnailUploadFieldProps) => {
  const { uploadVideo: uploadFile, uploading, progress, error, resetProgress } = useVideoUploadSpaces();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"upload" | "url">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{ savings: number; percentage: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    // Max 10MB for original file
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setCompressing(true);
    resetProgress();

    try {
      // Compress the image
      const compressedFile = await compressImage(file, {
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.85,
        mimeType: 'image/webp'
      });

      const stats = getCompressionStats(file.size, compressedFile.size);
      setCompressionStats(stats);
      setSelectedFile(compressedFile);

      // Create preview URL
      const preview = URL.createObjectURL(compressedFile);
      setPreviewUrl(preview);
    } catch (err) {
      console.error('Compression failed:', err);
      // Fallback to original file if compression fails
      setSelectedFile(file);
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    } finally {
      setCompressing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    const result = await uploadFile(selectedFile, folder);
    if (result) {
      // Use CDN URL for better performance
      onChange(result.cdnUrl);
      setSelectedFile(null);
      setCompressionStats(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setCompressionStats(null);
    resetProgress();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={uploadMode === "upload" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("upload")}
            className="h-7 px-2 text-xs"
          >
            Upload
          </Button>
          <Button
            type="button"
            variant={uploadMode === "url" ? "default" : "ghost"}
            size="sm"
            onClick={() => setUploadMode("url")}
            className="h-7 px-2 text-xs"
          >
            URL
          </Button>
        </div>
      </div>

      {uploadMode === "url" ? (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
          {value && (
            <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-muted">
              <img 
                src={value} 
                alt="Thumbnail preview" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Current thumbnail preview */}
          {value && !selectedFile && !compressing && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="relative w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                <img 
                  src={value} 
                  alt="Current thumbnail" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Thumbnail uploaded</p>
                <p className="text-xs text-muted-foreground truncate">{value}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Compressing state */}
          {compressing && (
            <div className="flex items-center gap-3 p-6 bg-muted/50 rounded-lg justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Optimizing image...</span>
            </div>
          )}

          {/* File selection with drag-and-drop */}
          {!selectedFile && !uploading && !compressing && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragging 
                  ? "border-primary bg-primary/10" 
                  : "hover:border-primary hover:bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragging ? "Drop image here" : "Drag & drop or click to select"}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP up to 10MB • Auto-optimized to WebP
              </p>
            </div>
          )}

          {/* Selected file / uploading */}
          {selectedFile && !compressing && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {previewUrl && (
                  <div className="relative w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                    {compressionStats && compressionStats.percentage > 0 && (
                      <span className="text-green-500 ml-2">
                        ({compressionStats.percentage}% smaller)
                      </span>
                    )}
                  </p>
                </div>
                {!uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Upload progress */}
              {uploading && progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <Progress value={progress.percent} className="h-2" />
                </div>
              )}

              {/* Upload complete */}
              {!uploading && value && (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <Check className="h-4 w-4" />
                  <span>Upload complete!</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Upload button */}
              {!uploading && !value && (
                <Button
                  type="button"
                  onClick={handleUpload}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Thumbnail
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
