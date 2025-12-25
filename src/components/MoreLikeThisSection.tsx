import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";

interface Content {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  year: number | null;
  rating: string | null;
  genre: string | null;
  contentType: string;
}

interface MoreLikeThisSectionProps {
  currentContent: Content;
  allContent: Content[];
  maxItems?: number;
}

export const MoreLikeThisSection = ({ 
  currentContent, 
  allContent,
  maxItems = 12 
}: MoreLikeThisSectionProps) => {
  const navigate = useNavigate();

  const similarContent = useMemo(() => {
    if (!currentContent.genre) return [];
    
    // Parse genres (could be comma-separated)
    const currentGenres = currentContent.genre
      .split(',')
      .map(g => g.trim().toLowerCase());
    
    // Find content with matching genres
    const matches = allContent
      .filter(content => {
        // Exclude current content
        if (content.id === currentContent.id) return false;
        
        // Must have genre
        if (!content.genre) return false;
        
        // Check for genre overlap
        const contentGenres = content.genre
          .split(',')
          .map(g => g.trim().toLowerCase());
        
        return currentGenres.some(cg => 
          contentGenres.some(g => g.includes(cg) || cg.includes(g))
        );
      })
      .map(content => {
        // Calculate relevance score
        const contentGenres = content.genre!
          .split(',')
          .map(g => g.trim().toLowerCase());
        
        const matchCount = currentGenres.filter(cg => 
          contentGenres.some(g => g.includes(cg) || cg.includes(g))
        ).length;
        
        // Bonus for same content type
        const typeBonus = content.contentType === currentContent.contentType ? 2 : 0;
        
        return {
          ...content,
          relevanceScore: matchCount + typeBonus
        };
      })
      .sort((a, b) => {
        // Sort by relevance first, then by year
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return (b.year || 0) - (a.year || 0);
      })
      .slice(0, maxItems);
    
    return matches;
  }, [currentContent, allContent, maxItems]);

  if (similarContent.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-display text-2xl mb-4">More Like This</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {similarContent.map((content) => (
          <div 
            key={content.id} 
            className="group cursor-pointer"
            onClick={() => navigate(`/content/${content.id}`)}
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
              {content.thumbnailUrl ? (
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            <h3 className="mt-2 font-medium text-sm truncate group-hover:text-brand transition-colors">
              {content.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {content.year && <span>{content.year}</span>}
              {content.rating && (
                <span className="flex items-center gap-0.5 text-yellow-500">
                  <Star className="h-3 w-3 fill-current" />
                  {content.rating}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
