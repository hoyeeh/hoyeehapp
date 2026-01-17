import { useState } from "react";
import { Search, Plus, Loader2, Gamepad2, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreatePlayableGame } from "@/hooks/usePlayableGames";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CrazyGame {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  embedUrl: string;
  category: string;
  tags: string[];
}

interface SearchResult {
  games: CrazyGame[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: string[];
}

export const CrazyGamesSearch = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<CrazyGame | null>(null);
  const [addedGames, setAddedGames] = useState<Set<string>>(new Set());
  
  const createGame = useCreatePlayableGame();

  const handleSearch = async (searchQuery?: string, searchCategory?: string) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery || query) params.set("q", searchQuery ?? query);
      if (searchCategory || category) params.set("category", searchCategory ?? category);

      const { data, error } = await supabase.functions.invoke("crazygames-search", {
        body: null,
        method: "GET",
      });

      // Use fetch directly for GET with query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crazygames-search?${params.toString()}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Search failed");
      
      const result = await response.json();
      setResults(result);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search games");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddGame = async (game: CrazyGame) => {
    try {
      await createGame.mutateAsync({
        title: game.title,
        description: game.description,
        thumbnail_url: game.thumbnailUrl,
        embed_url: game.embedUrl,
        source: "CrazyGames",
        embed_type: "iframe",
        tags: game.tags,
        age_group: "7+",
        languages: ["en"],
        subject: game.category,
        is_verified: true,
        is_active: true,
        display_order: 0,
        health_status: "unknown",
      });
      
      setAddedGames(prev => new Set([...prev, game.slug]));
      toast.success(`Added "${game.title}" to playables`);
      setSelectedGame(null);
    } catch (error) {
      toast.error("Failed to add game");
    }
  };

  // Load initial results
  useState(() => {
    handleSearch("", "");
  });

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search CrazyGames..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        
        {results?.categories && (
          <Select value={category} onValueChange={(v) => { setCategory(v); handleSearch(query, v); }}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {results.categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Button onClick={() => handleSearch()} disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* Results Grid */}
      {isSearching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : results ? (
        <>
          <p className="text-sm text-muted-foreground">
            Found {results.total} games
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.games.map((game) => {
              const isAdded = addedGames.has(game.slug);
              
              return (
                <div
                  key={game.slug}
                  className={cn(
                    "group relative rounded-lg border bg-card overflow-hidden cursor-pointer transition-all hover:border-primary",
                    isAdded && "border-green-500/50"
                  )}
                  onClick={() => !isAdded && setSelectedGame(game)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={game.thumbnailUrl}
                      alt={game.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    {isAdded && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <div className="bg-green-500 rounded-full p-2">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    )}
                    {!isAdded && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="secondary" className="gap-1">
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="font-medium text-sm truncate">{game.title}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {game.category}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Gamepad2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Search for games to add to your playables</p>
        </div>
      )}

      {/* Add Game Dialog */}
      <Dialog open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Add Game
            </DialogTitle>
          </DialogHeader>
          
          {selectedGame && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <img
                  src={selectedGame.thumbnailUrl}
                  alt={selectedGame.title}
                  className="h-24 w-24 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedGame.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {selectedGame.description}
                  </p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {selectedGame.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="text-sm space-y-1 bg-muted/50 rounded-lg p-3">
                <p><span className="text-muted-foreground">Category:</span> {selectedGame.category}</p>
                <p><span className="text-muted-foreground">Source:</span> CrazyGames</p>
                <p><span className="text-muted-foreground">Embed Type:</span> Iframe (Proxied)</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGame(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedGame && handleAddGame(selectedGame)}
              disabled={createGame.isPending}
              className="gap-2"
            >
              {createGame.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add to Playables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
