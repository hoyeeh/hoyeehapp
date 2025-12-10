import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface ContentFilterProps {
  onFilterChange: (filters: FilterState) => void;
  contentType?: "movie" | "series";
}

export interface FilterState {
  genre: string | null;
  year: number | null;
  contentType: "movie" | "series" | null;
}

export const ContentFilter = ({ onFilterChange, contentType }: ContentFilterProps) => {
  const [filters, setFilters] = useState<FilterState>({
    genre: null,
    year: null,
    contentType: contentType || null,
  });

  // Fetch genres from database
  const { data: genres = [] } = useQuery({
    queryKey: ["genres-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genres")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Generate year options (last 50 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const updateFilter = (key: keyof FilterState, value: string | number | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      genre: null,
      year: null,
      contentType: contentType || null,
    });
  };

  const hasActiveFilters = filters.genre || filters.year || (!contentType && filters.contentType);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <Filter className="h-5 w-5 text-muted-foreground" />

      {/* Genre Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {filters.genre || "All Genres"}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          <DropdownMenuItem onClick={() => updateFilter("genre", null)}>
            All Genres
          </DropdownMenuItem>
          {genres.map((genre: any) => (
            <DropdownMenuItem
              key={genre.id}
              onClick={() => updateFilter("genre", genre.name)}
              className={filters.genre === genre.name ? "bg-accent" : ""}
            >
              {genre.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Year Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {filters.year || "All Years"}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          <DropdownMenuItem onClick={() => updateFilter("year", null)}>
            All Years
          </DropdownMenuItem>
          {years.map((year) => (
            <DropdownMenuItem
              key={year}
              onClick={() => updateFilter("year", year)}
              className={filters.year === year ? "bg-accent" : ""}
            >
              {year}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content Type Filter (only shown when not on specific page) */}
      {!contentType && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {filters.contentType === "movie"
                ? "Movies"
                : filters.contentType === "series"
                ? "TV Shows"
                : "All Types"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => updateFilter("contentType", null)}>
              All Types
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateFilter("contentType", "movie")}
              className={filters.contentType === "movie" ? "bg-accent" : ""}
            >
              Movies
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateFilter("contentType", "series")}
              className={filters.contentType === "series" ? "bg-accent" : ""}
            >
              TV Shows
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {filters.genre && (
            <Badge variant="secondary" className="gap-1">
              {filters.genre}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("genre", null)}
              />
            </Badge>
          )}
          {filters.year && (
            <Badge variant="secondary" className="gap-1">
              {filters.year}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("year", null)}
              />
            </Badge>
          )}
          {!contentType && filters.contentType && (
            <Badge variant="secondary" className="gap-1">
              {filters.contentType === "movie" ? "Movies" : "TV Shows"}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("contentType", null)}
              />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
