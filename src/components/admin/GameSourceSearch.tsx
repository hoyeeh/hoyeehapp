import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ExternalLink, Gamepad2, GraduationCap, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SearchGame {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  embedUrl: string;
  category?: string;
  creator?: string;
  source?: string;
  ageGroup?: string;
  subject?: string;
  tags: string[];
  embedType?: 'iframe' | 'external';
}

interface GameSourceSearchProps {
  onAddGame: (game: {
    title: string;
    description: string;
    thumbnail_url: string;
    embed_url: string;
    source: string;
    source_url?: string;
    source_id?: string;
    embed_type: string;
    age_group?: string;
    tags: string[];
  }) => void;
  existingUrls: string[];
}

export const GameSourceSearch = ({ onAddGame, existingUrls }: GameSourceSearchProps) => {
  const [activeTab, setActiveTab] = useState("crazygames");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  // CrazyGames search
  const { data: crazyGamesData, isLoading: crazyLoading } = useQuery({
    queryKey: ["crazygames-search", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      
      const { data, error } = await supabase.functions.invoke("crazygames-search", {
        body: null,
        method: "GET",
      });
      
      // Fallback to direct fetch if invoke doesn't work for GET
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crazygames-search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to search CrazyGames");
      return response.json();
    },
    enabled: activeTab === "crazygames",
  });

  // itch.io search
  const { data: itchioData, isLoading: itchioLoading } = useQuery({
    queryKey: ["itchio-search", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/itchio-search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to search itch.io");
      return response.json();
    },
    enabled: activeTab === "itchio",
  });

  // Educational games search
  const { data: eduData, isLoading: eduLoading } = useQuery({
    queryKey: ["educational-search", searchQuery, selectedSource, selectedSubject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedSource && selectedSource !== "all") params.set("source", selectedSource);
      if (selectedSubject && selectedSubject !== "all") params.set("subject", selectedSubject);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/educational-games-search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to search educational games");
      return response.json();
    },
    enabled: activeTab === "educational",
  });

  const handleAddGame = (game: SearchGame, sourceName: string) => {
    const isAlreadyAdded = existingUrls.includes(game.embedUrl);
    
    if (isAlreadyAdded) {
      toast.error("This game is already in your library");
      return;
    }

    onAddGame({
      title: game.title,
      description: game.description,
      thumbnail_url: game.thumbnail,
      embed_url: game.embedUrl,
      source: sourceName,
      source_url: game.embedUrl,
      source_id: game.slug,
      embed_type: game.embedType || "iframe",
      age_group: game.ageGroup,
      tags: game.tags,
    });

    toast.success(`Added "${game.title}" to your library`);
  };

  const isGameAdded = (url: string) => existingUrls.includes(url);

  const renderGameCard = (game: SearchGame, sourceName: string) => (
    <Card key={game.slug} className="overflow-hidden group hover:ring-2 hover:ring-primary/50 transition-all">
      <div className="relative aspect-video">
        <img
          src={game.thumbnail}
          alt={game.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {game.embedType === "external" && (
          <Badge className="absolute top-2 right-2 bg-orange-500">
            <ExternalLink className="w-3 h-3 mr-1" />
            External
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <h4 className="font-medium text-sm truncate">{game.title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {game.category && (
            <Badge variant="outline" className="text-xs">{game.category}</Badge>
          )}
          {game.subject && (
            <Badge variant="outline" className="text-xs">{game.subject}</Badge>
          )}
          {game.ageGroup && (
            <Badge variant="secondary" className="text-xs">{game.ageGroup}</Badge>
          )}
        </div>
        <Button
          size="sm"
          className="w-full mt-3"
          disabled={isGameAdded(game.embedUrl)}
          onClick={() => handleAddGame(game, sourceName)}
        >
          {isGameAdded(game.embedUrl) ? (
            "Already Added"
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1" />
              Add to Library
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderLoadingSkeletons = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video" />
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="crazygames" className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            CrazyGames
          </TabsTrigger>
          <TabsTrigger value="itchio" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            itch.io
          </TabsTrigger>
          <TabsTrigger value="educational" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Educational
          </TabsTrigger>
        </TabsList>

        {/* CrazyGames Tab */}
        <TabsContent value="crazygames" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search CrazyGames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {crazyGamesData?.categories?.map((cat: string) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {crazyLoading ? (
            renderLoadingSkeletons()
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {crazyGamesData?.games?.map((game: SearchGame) =>
                renderGameCard({ ...game, embedType: "iframe" }, "CrazyGames")
              )}
            </div>
          )}
        </TabsContent>

        {/* itch.io Tab */}
        <TabsContent value="itchio" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search itch.io games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {itchioData?.categories?.map((cat: string) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itchioLoading ? (
            renderLoadingSkeletons()
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {itchioData?.games?.map((game: SearchGame) =>
                renderGameCard({ ...game, embedType: "iframe" }, "itch.io")
              )}
            </div>
          )}
        </TabsContent>

        {/* Educational Tab */}
        <TabsContent value="educational" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search educational games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {eduData?.sources?.map((src: string) => (
                  <SelectItem key={src} value={src}>{src}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {eduData?.subjects?.map((subj: string) => (
                  <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {eduLoading ? (
            renderLoadingSkeletons()
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {eduData?.games?.map((game: SearchGame) =>
                renderGameCard(game, game.source || "Educational")
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
