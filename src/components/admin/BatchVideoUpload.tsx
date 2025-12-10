import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, CheckCircle, AlertCircle, Loader2, Film } from "lucide-react";
import { useVideoUploadSpaces } from "@/hooks/useVideoUploadSpaces";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  video_url?: string | null;
}

interface BatchVideoUploadProps {
  seasonId: string;
  seasonNumber: number;
  episodes: Episode[];
  onComplete: () => void;
  onClose: () => void;
}

interface FileMapping {
  file: File;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export const BatchVideoUpload = ({ 
  seasonId, 
  seasonNumber, 
  episodes, 
  onComplete, 
  onClose 
}: BatchVideoUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Filter only video files
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    
    if (videoFiles.length === 0) {
      toast({ title: "No valid video files selected", variant: "destructive" });
      return;
    }

    // Try to auto-match files to episodes based on filename
    const newMappings: FileMapping[] = [];
    
    for (const file of videoFiles) {
      // Try to extract episode number from filename (e.g., "S01E03.mp4", "episode_3.mp4", "03.mp4")
      const episodeMatch = file.name.match(/(?:e|ep|episode[_\s-]?)(\d+)|^(\d+)\./i);
      const extractedNumber = episodeMatch ? parseInt(episodeMatch[1] || episodeMatch[2]) : null;
      
      // Find matching episode
      let matchedEpisode = extractedNumber 
        ? episodes.find(ep => ep.episode_number === extractedNumber && !ep.video_url)
        : null;
      
      // If no match by number, try to match to first unassigned episode
      if (!matchedEpisode) {
        const assignedIds = new Set(newMappings.map(m => m.episodeId));
        matchedEpisode = episodes.find(ep => !ep.video_url && !assignedIds.has(ep.id));
      }
      
      if (matchedEpisode) {
        newMappings.push({
          file,
          episodeId: matchedEpisode.id,
          episodeNumber: matchedEpisode.episode_number,
          episodeTitle: matchedEpisode.title,
          status: 'pending',
          progress: 0,
        });
      }
    }
    
    if (newMappings.length === 0) {
      toast({ 
        title: "No episodes available", 
        description: "All episodes already have videos or no matching episodes found",
        variant: "destructive" 
      });
      return;
    }
    
    setFileMappings(prev => [...prev, ...newMappings]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMapping = (index: number) => {
    setFileMappings(prev => prev.filter((_, i) => i !== index));
  };

  const updateMappingEpisode = (index: number, episodeId: string) => {
    const episode = episodes.find(ep => ep.id === episodeId);
    if (!episode) return;
    
    setFileMappings(prev => prev.map((m, i) => 
      i === index 
        ? { ...m, episodeId, episodeNumber: episode.episode_number, episodeTitle: episode.title }
        : m
    ));
  };

  const startBatchUpload = async () => {
    if (fileMappings.length === 0) return;
    
    setIsUploading(true);
    let successCount = 0;
    
    for (let i = 0; i < fileMappings.length; i++) {
      const mapping = fileMappings[i];
      
      // Update status to uploading
      setFileMappings(prev => prev.map((m, idx) => 
        idx === i ? { ...m, status: 'uploading' } : m
      ));
      
      try {
        // Get presigned URL
        const { data: presignData, error: presignError } = await supabase.functions.invoke(
          'generate-upload-url',
          {
            body: {
              fileName: mapping.file.name,
              fileType: mapping.file.type,
              folder: `episodes/s${seasonNumber}`,
            },
          }
        );
        
        if (presignError || !presignData?.presignedUrl) {
          throw new Error(presignError?.message || 'Failed to get upload URL');
        }
        
        const { presignedUrl, publicUrl, cdnUrl } = presignData;
        
        // Upload file with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setFileMappings(prev => prev.map((m, idx) => 
                idx === i ? { ...m, progress: percent } : m
              ));
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          
          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', mapping.file.type);
          xhr.setRequestHeader('x-amz-acl', 'public-read');
          xhr.send(mapping.file);
        });
        
        // Update episode with CDN URL for better performance
        const { error: updateError } = await supabase
          .from('episodes')
          .update({ video_url: cdnUrl || publicUrl })
          .eq('id', mapping.episodeId);
        
        if (updateError) throw updateError;
        
        // Mark as success
        setFileMappings(prev => prev.map((m, idx) => 
          idx === i ? { ...m, status: 'success', progress: 100 } : m
        ));
        successCount++;
        
      } catch (error) {
        console.error('Upload error:', error);
        setFileMappings(prev => prev.map((m, idx) => 
          idx === i ? { 
            ...m, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : m
        ));
      }
    }
    
    setIsUploading(false);
    
    if (successCount > 0) {
      toast({ 
        title: "Batch Upload Complete", 
        description: `Successfully uploaded ${successCount} of ${fileMappings.length} videos` 
      });
      onComplete();
    }
  };

  const pendingCount = fileMappings.filter(m => m.status === 'pending').length;
  const successCount = fileMappings.filter(m => m.status === 'success').length;
  const errorCount = fileMappings.filter(m => m.status === 'error').length;

  const availableEpisodes = episodes.filter(ep => 
    !ep.video_url && !fileMappings.some(m => m.episodeId === ep.id)
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Batch Video Upload - Season {seasonNumber}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File selection */}
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Select multiple video files to upload at once
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Tip: Name files with episode numbers (e.g., E01.mp4, E02.mp4) for auto-matching
          </p>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || availableEpisodes.length === 0}
          >
            Select Videos
          </Button>
          {availableEpisodes.length === 0 && fileMappings.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              All episodes already have videos assigned
            </p>
          )}
        </div>

        {/* File mappings */}
        {fileMappings.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Files to Upload ({fileMappings.length})</span>
              <div className="flex gap-3 text-muted-foreground">
                {pendingCount > 0 && <span>Pending: {pendingCount}</span>}
                {successCount > 0 && <span className="text-green-500">Success: {successCount}</span>}
                {errorCount > 0 && <span className="text-destructive">Failed: {errorCount}</span>}
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fileMappings.map((mapping, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {mapping.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                      {mapping.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                      {mapping.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                      <span className="text-sm truncate">{mapping.file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({formatSize(mapping.file.size)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">→</span>
                      <select
                        value={mapping.episodeId}
                        onChange={(e) => updateMappingEpisode(index, e.target.value)}
                        disabled={mapping.status !== 'pending' || isUploading}
                        className="text-xs bg-background border border-border rounded px-2 py-1"
                      >
                        <option value={mapping.episodeId}>
                          E{mapping.episodeNumber}: {mapping.episodeTitle}
                        </option>
                        {episodes
                          .filter(ep => ep.id !== mapping.episodeId && !ep.video_url)
                          .map(ep => (
                            <option key={ep.id} value={ep.id}>
                              E{ep.episode_number}: {ep.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    {mapping.status === 'uploading' && (
                      <Progress value={mapping.progress} className="h-1 mt-2" />
                    )}
                    {mapping.error && (
                      <p className="text-xs text-destructive mt-1">{mapping.error}</p>
                    )}
                  </div>
                  {mapping.status === 'pending' && !isUploading && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeMapping(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={startBatchUpload}
            disabled={isUploading || pendingCount === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {pendingCount} Video{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
