import { useState } from "react";
import { useCreateContent } from "@/hooks/useAdmin";
import { useVideoUploadSpaces } from "@/hooks/useVideoUploadSpaces";
import { getVideoDuration } from "@/utils/videoDuration";
import { useQuery } from "@tanstack/react-query";
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

interface TMDBDetails extends TMDBResult {
  duration: number;
  genres: string[];
  content_rating?: string;
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
  director?: string | null;
}

export const ContentUploadForm = ({ onClose }: ContentUploadFormProps) => {
  const createContent = useCreateContent();
  const { uploadVideo, uploading, progress, error: uploadError, resetProgress } = useVideoUploadSpaces();

  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"movie" | "series">("movie");
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [tmdbDetails, setTmdbDetails] = useState<TMDBDetails | null>(null);

  // Form state - is_premium defaults to true
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
    content_type: "movie",
    year: new Date().getFullYear(),
    rating: "",
    is_premium: true,
    duration: 0,
    thumbnail_url: "",
    tmdb_id: null as number | null,
    content_rating: "PG",
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleVideoFileSelect = async (file: File | null) => {
    setVideoFile(file);
    if (file) {
      try {
        const duration = await getVideoDuration(file);
        setFormData(prev => ({ ...prev, duration: Math.round(duration / 60) }));
      } catch (error) {
        console.error("Failed to detect video duration:", error);
      }
    }
  };

  // Fetch genres from database
  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

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
        body: { query: searchQuery, type: searchType, multi: true }
      });

      if (error) throw error;

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        toast.success(`Found ${data.results.length} results`);
      } else if (data.error === 'No results found') {
        toast.info("No results found. Try a different search term.");
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Failed to search TMDB");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (result: TMDBResult) => {
    setSelectedResult(result);
    setFetchingDetails(true);
    setTmdbDetails(null);
    
    // Immediately set basic data
    setFormData(prev => ({
      ...prev,
      title: result.title,
      description: result.description || "",
      year: parseInt(result.year) || new Date().getFullYear(),
      rating: result.rating || "",
      content_type: searchType,
      thumbnail_url: result.thumbnail_url || "",
      tmdb_id: result.tmdb_id,
    }));

    // Fetch details to get duration, genres, cast, director, and content_rating
    try {
      const { data, error } = await supabase.functions.invoke('tmdb-details', {
        body: { tmdb_id: result.tmdb_id, type: searchType }
      });

      if (!error && data) {
        setTmdbDetails(data);
        setFormData(prev => ({
          ...prev,
          duration: data.duration || 0,
          genre: data.genres?.[0] || "",
          content_rating: data.content_rating || "PG",
        }));
        toast.success(`Fetched: ${data.duration} min, Rating: ${data.content_rating}`);
      }
    } catch (error) {
      console.error('Failed to fetch details:', error);
    } finally {
      setFetchingDetails(false);
    }
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
        const result = await uploadVideo(videoFile, 'movies');
        if (result) videoUrl = result.cdnUrl;
      }

      if (thumbnailFile) {
        setThumbnailUploading(true);
        const result = await uploadVideo(thumbnailFile, 'thumbnails');
        if (result) thumbnailUrl = result.cdnUrl;
        setThumbnailUploading(false);
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
      is_premium: true,
      duration: 0,
      thumbnail_url: "",
      tmdb_id: null,
      content_rating: "PG",
    });
    setSelectedResult(null);
    setSearchResults([]);
    setSearchQuery("");
    setVideoFile(null);
    setThumbnailFile(null);
    setTmdbDetails(null);
    resetProgress();
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

              {/* Search Results Grid */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label>Search Results ({searchResults.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                    {searchResults.map((result) => (
                      <div
                        key={result.tmdb_id}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedResult?.tmdb_id === result.tmdb_id
                            ? 'border-primary ring-2 ring-primary/50'
                            : 'border-transparent hover:border-muted-foreground/50'
                        }`}
                        onClick={() => handleSelectResult(result)}
                      >
                        {result.thumbnail_url ? (
                          <img
                            src={result.thumbnail_url}
                            alt={result.title}
                            className="w-full h-36 object-cover"
                          />
                        ) : (
                          <div className="w-full h-36 bg-muted flex items-center justify-center">
                            <Film className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs font-medium text-white line-clamp-2">{result.title}</p>
                          <p className="text-xs text-white/70">{result.year} • ⭐ {result.rating}</p>
                        </div>
                        {selectedResult?.tmdb_id === result.tmdb_id && (
                          <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Content Preview */}
              {selectedResult && (
                <div className="border border-border rounded-lg p-4 bg-secondary/30 space-y-4">
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
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>Year: {selectedResult.year}</span>
                        <span>⭐ {selectedResult.rating}</span>
                        {fetchingDetails ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Fetching...
                          </span>
                        ) : (
                          <>
                            {formData.duration > 0 && (
                              <span className="text-primary">{formData.duration} min</span>
                            )}
                            {formData.content_rating && (
                              <span className="px-2 py-0.5 bg-primary/20 rounded text-xs font-medium">
                                {formData.content_rating}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cast & Director Info */}
                  {tmdbDetails && (tmdbDetails.cast?.length || tmdbDetails.director) && (
                    <div className="border-t border-border pt-3 space-y-2">
                      {tmdbDetails.director && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Director:</span>{" "}
                          <span className="font-medium">{tmdbDetails.director}</span>
                        </p>
                      )}
                      {tmdbDetails.cast && tmdbDetails.cast.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Cast:</p>
                          <div className="flex flex-wrap gap-2">
                            {tmdbDetails.cast.slice(0, 6).map((actor) => (
                              <div key={actor.id} className="flex items-center gap-2 bg-secondary/50 rounded-full px-3 py-1">
                                {actor.profile_path && (
                                  <img
                                    src={actor.profile_path}
                                    alt={actor.name}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                )}
                                <span className="text-xs">{actor.name}</span>
                              </div>
                            ))}
                            {tmdbDetails.cast.length > 6 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{tmdbDetails.cast.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                    <Select value={formData.genre} onValueChange={(v) => setFormData({ ...formData, genre: v })}>
                      <SelectTrigger><SelectValue placeholder="Select genre..." /></SelectTrigger>
                      <SelectContent>
                        {genres.map((genre: any) => (
                          <SelectItem key={genre.id} value={genre.name}>{genre.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    onChange={(e) => handleVideoFileSelect(e.target.files?.[0] || null)}
                  />
                  {progress && (
                    <div className="space-y-1">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{progress.percent}% uploaded</p>
                    </div>
                  )}
                </div>

                {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={submitting || uploading}>
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
                  <Select value={formData.genre} onValueChange={(v) => setFormData({ ...formData, genre: v })}>
                    <SelectTrigger><SelectValue placeholder="Select genre..." /></SelectTrigger>
                    <SelectContent>
                      {genres.map((genre: any) => (
                        <SelectItem key={genre.id} value={genre.name}>{genre.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Input type="file" accept="video/*" onChange={(e) => handleVideoFileSelect(e.target.files?.[0] || null)} />
                  {progress && (
                    <div className="space-y-1">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{progress.percent}% uploaded</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Thumbnail Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={submitting || uploading || thumbnailUploading}>
                  {(submitting || uploading || thumbnailUploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
