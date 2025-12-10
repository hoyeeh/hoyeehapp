import { useState } from "react";
import { useCreateContent } from "@/hooks/useAdmin";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, X, Upload, Search, Film, Tv, Check } from "lucide-react";

interface ContentUploadFormProps {
  onClose: () => void;
}

interface TMDBResult {
  tmdb_id: number;
  title: string;
  description: string;
  thumbnail_url: string | null;
  backdrop_url: string | null;
  year: string;
  rating: string;
  popularity: number;
}

export const ContentUploadForm = ({ onClose }: ContentUploadFormProps) => {
  const createContent = useCreateContent();
  const { uploadVideo, uploadThumbnail, uploading, error: uploadError } = useVideoUpload();

  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"movie" | "series">("movie");
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
    content_type: "movie",
    year: new Date().getFullYear(),
    rating: "",
    is_premium: false,
    duration: 0,
    thumbnail_url: "",
    tmdb_id: null as number | null,
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setSelectedResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('tmdb-search', {
        body: { query: searchQuery, type: searchType }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error === 'No results found') {
          toast.info("No results found. Try a different search term.");
        } else {
          throw new Error(data.error);
        }
      } else {
        // The current API returns a single result, but we can display it
        setSearchResults([data]);
        toast.success(`Found: ${data.title}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Failed to search TMDB");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result: TMDBResult) => {
    setSelectedResult(result);
    setFormData({
      ...formData,
      title: result.title,
      description: result.description || "",
      year: parseInt(result.year) || new Date().getFullYear(),
      rating: result.rating || "",
      content_type: searchType,
      thumbnail_url: result.thumbnail_url || "",
      tmdb_id: result.tmdb_id,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      let videoUrl = "";
      let thumbnailUrl = formData.thumbnail_url || "";

      if (videoFile) {
        const url = await uploadVideo(videoFile, formData.title);
        if (url) videoUrl = url;
      }

      if (thumbnailFile) {
        const url = await uploadThumbnail(thumbnailFile, formData.title);
        if (url) thumbnailUrl = url;
      }

      await createContent.mutateAsync({
        title: formData.title,
        description: formData.description,
        genre: formData.genre,
        content_type: formData.content_type,
        year: formData.year,
        rating: formData.rating,
        is_premium: formData.is_premium,
        duration: formData.duration,
        video_url: videoUrl || undefined,
        thumbnail_url: thumbnailUrl || undefined,
        tmdb_id: formData.tmdb_id,
      });

      toast.success("Content created successfully!");
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error("Failed to create content");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      genre: "",
      content_type: "movie",
      year: new Date().getFullYear(),
      rating: "",
      is_premium: false,
      duration: 0,
      thumbnail_url: "",
      tmdb_id: null,
    });
    setSelectedResult(null);
    setSearchResults([]);
    setSearchQuery("");
    setVideoFile(null);
    setThumbnailFile(null);
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "search" | "manual"); resetForm(); }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Import from TMDB
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Upload className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            {/* TMDB Search */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select value={searchType} onValueChange={(v) => setSearchType(v as "movie" | "series")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">
                      <span className="flex items-center gap-2"><Film className="h-4 w-4" /> Movie</span>
                    </SelectItem>
                    <SelectItem value="series">
                      <span className="flex items-center gap-2"><Tv className="h-4 w-4" /> TV Show</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search movies or TV shows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label>Search Results</Label>
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.tmdb_id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedResult?.tmdb_id === result.tmdb_id
                            ? 'bg-brand/20 border border-brand'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                        onClick={() => handleSelectResult(result)}
                      >
                        {result.thumbnail_url && (
                          <img
                            src={result.thumbnail_url}
                            alt={result.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {result.year} • ⭐ {result.rating}
                          </p>
                        </div>
                        {selectedResult?.tmdb_id === result.tmdb_id && (
                          <Check className="h-5 w-5 text-brand flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Content Preview */}
              {selectedResult && (
                <div className="border border-border rounded-lg p-4 bg-secondary/30">
                  <div className="flex gap-4">
                    {selectedResult.thumbnail_url && (
                      <img
                        src={selectedResult.thumbnail_url}
                        alt={selectedResult.title}
                        className="w-24 h-36 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-lg">{selectedResult.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {selectedResult.description}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span>Year: {selectedResult.year}</span>
                        <span>Rating: ⭐ {selectedResult.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Options for TMDB Import */}
            {selectedResult && (
              <div className="space-y-4 border-t border-border pt-4">
                <h4 className="font-medium">Additional Options</h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Input
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="Drama, Action..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Label>Premium Content</Label>
                  <Switch
                    checked={formData.is_premium}
                    onCheckedChange={(v) => setFormData({ ...formData, is_premium: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Video File (max 2GB)</Label>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                </div>

                {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={submitting || uploading} className="bg-brand hover:bg-brand/90">
                    {(submitting || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import Content
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual">
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
                <Button type="submit" disabled={submitting || uploading} className="bg-brand hover:bg-brand/90">
                  {(submitting || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Content
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
