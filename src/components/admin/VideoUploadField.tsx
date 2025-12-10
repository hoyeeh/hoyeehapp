import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useVideoUploadSpaces } from "@/hooks/useVideoUploadSpaces";
import { Upload, X, Check, Film, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
}

export const VideoUploadField = ({ 
  value, 
  onChange, 
  label = "Video",
  folder = "episodes"
}: VideoUploadFieldProps) => {
  const { uploadVideo, uploading, progress, error, resetProgress } = useVideoUploadSpaces();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }
      // Max 2GB
      if (file.size > 2 * 1024 * 1024 * 1024) {
        alert('File size must be less than 2GB');
        return;
      }
      setSelectedFile(file);
      resetProgress();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    const result = await uploadVideo(selectedFile, folder);
    if (result) {
      onChange(result.publicUrl);
      setSelectedFile(null);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    resetProgress();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
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
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      ) : (
        <div className="space-y-3">
          {/* Current video preview */}
          {value && !selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Film className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Video uploaded</p>
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

          {/* File selection */}
          {!selectedFile && !uploading && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                "hover:border-primary hover:bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select video</p>
              <p className="text-xs text-muted-foreground">MP4, MOV, AVI up to 2GB</p>
            </div>
          )}

          {/* Selected file / uploading */}
          {selectedFile && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Film className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(selectedFile.size)}
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
                  <p className="text-xs text-muted-foreground text-center">
                    {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                  </p>
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
                  Upload Video
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
