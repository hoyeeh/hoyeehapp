import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFeaturedCreators } from "@/hooks/useFeaturedCreators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Play, Star, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeaturedCreatorCarousel() {
  const navigate = useNavigate();
  const { data: featuredCreators = [], isLoading } = useFeaturedCreators();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToNext = useCallback(() => {
    if (featuredCreators.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % featuredCreators.length);
  }, [featuredCreators.length]);

  const goToPrev = useCallback(() => {
    if (featuredCreators.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + featuredCreators.length) % featuredCreators.length);
  }, [featuredCreators.length]);

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (isPaused || featuredCreators.length <= 1) return;
    
    const interval = setInterval(goToNext, 8000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, featuredCreators.length]);

  if (isLoading) {
    return (
      <div className="relative w-full aspect-[21/9] md:aspect-[21/7] bg-card/50 animate-pulse rounded-2xl" />
    );
  }

  if (featuredCreators.length === 0) {
    return null;
  }

  const currentCreator = featuredCreators[currentIndex];

  return (
    <div 
      className="relative w-full aspect-[16/9] md:aspect-[21/7] rounded-2xl overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={currentCreator.banner_image_url}
          alt={currentCreator.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 lg:p-12">
        <div className="max-w-2xl space-y-4">
          {/* Featured Badge */}
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/90 text-black font-bold px-3 py-1">
              <Star className="h-3 w-3 mr-1 fill-current" />
              FEATURED CREATOR
            </Badge>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {currentCreator.title}
          </h2>

          {/* Subtitle */}
          {currentCreator.subtitle && (
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground max-w-xl line-clamp-2">
              {currentCreator.subtitle}
            </p>
          )}

          {/* Creator Info */}
          {currentCreator.creator_profiles && (
            <div className="flex items-center gap-3">
              {currentCreator.creator_profiles.avatar_url && (
                <img
                  src={currentCreator.creator_profiles.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full border-2 border-primary"
                />
              )}
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">
                    {currentCreator.creator_profiles.display_name}
                  </span>
                  {currentCreator.creator_profiles.is_verified && (
                    <CheckCircle className="h-4 w-4 text-primary fill-primary/20" />
                  )}
                </div>
                {currentCreator.creator_profiles.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {currentCreator.creator_profiles.bio}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button 
              size="lg" 
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => {
                // Navigate to creator's content or featured content
              }}
            >
              <Play className="h-5 w-5 fill-current" />
              {currentCreator.cta_label || 'View Content'}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-foreground/20 hover:bg-foreground/10"
            >
              More Info
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {featuredCreators.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background/80 backdrop-blur-sm h-12 w-12 rounded-full"
            onClick={goToPrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background/80 backdrop-blur-sm h-12 w-12 rounded-full"
            onClick={goToNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dot Indicators */}
      {featuredCreators.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {featuredCreators.map((_, index) => (
            <button
              key={index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentIndex 
                  ? "w-8 bg-primary" 
                  : "w-2 bg-foreground/30 hover:bg-foreground/50"
              )}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
