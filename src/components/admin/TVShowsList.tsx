import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Edit2, Trash2, Layers } from "lucide-react";
import TVShowManagement from "./TVShowManagement";

interface TVShowsListProps {
  content: any[];
  onDelete: (id: string, title: string) => void;
}

export const TVShowsList = ({ content, onDelete }: TVShowsListProps) => {
  const [managingShow, setManagingShow] = useState<{ id: string; title: string } | null>(null);
  
  const tvShows = content.filter(c => c.content_type === "series");

  if (managingShow) {
    return (
      <TVShowManagement
        contentId={managingShow.id}
        contentTitle={managingShow.title}
        onClose={() => setManagingShow(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display flex items-center gap-2">
          <Tv className="h-6 w-6 text-primary" />
          TV Shows ({tvShows.length})
        </h2>
      </div>

      {tvShows.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No TV shows found. Add a series from the Content or Upload section.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tvShows.map((show) => (
            <Card key={show.id} className="bg-card hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <img
                  src={show.thumbnail_url || "/placeholder.svg"}
                  alt={show.title}
                  className="w-24 h-36 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{show.title}</h3>
                    {show.is_premium && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {show.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{show.year}</span>
                    <span>{show.genre}</span>
                    <span>{show.rating}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    onClick={() => setManagingShow({ id: show.id, title: show.title })}
                    className="gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    Manage Seasons
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(show.id, show.title)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
