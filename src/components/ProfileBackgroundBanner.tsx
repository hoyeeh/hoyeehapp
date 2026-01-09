import { useProfileBackground, ProfileBackgroundContent } from "@/hooks/useProfileBackground";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ProfileBackgroundBannerProps {
  children: React.ReactNode;
  variant?: "desktop" | "mobile";
}

export const ProfileBackgroundBanner = ({
  children,
  variant = "desktop",
}: ProfileBackgroundBannerProps) => {
  const { backgroundContent } = useProfileBackground();
  const [displayContent, setDisplayContent] = useState<ProfileBackgroundContent | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle smooth transition between backgrounds
  useEffect(() => {
    if (!backgroundContent) return;
    
    if (!displayContent) {
      setDisplayContent(backgroundContent);
      return;
    }

    if (backgroundContent.id !== displayContent.id) {
      setIsTransitioning(true);
      const timeout = setTimeout(() => {
        setDisplayContent(backgroundContent);
        setIsTransitioning(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [backgroundContent, displayContent]);

  if (!displayContent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        {children}
      </div>
    );
  }

  // Get the appropriate image URL based on variant
  const imageUrl = variant === "mobile" 
    ? displayContent.mobileImageUrl 
    : displayContent.desktopImageUrl;

  if (variant === "mobile") {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background Image - Poster for mobile */}
        <div className="absolute inset-0">
          <img
            src={imageUrl || displayContent.desktopImageUrl}
            alt={displayContent.title}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-500",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}
          />
          {/* Dark gradient overlay from bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent h-40" />
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center pt-safe">
          {/* Logo at top center */}
          <div className="pt-12 pb-4">
            <Logo className="h-10" />
          </div>

          {/* Title in middle */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-20">
            <h1 className={cn(
              "text-4xl sm:text-5xl font-display font-bold text-foreground text-center tracking-tight uppercase mb-2 drop-shadow-2xl transition-opacity duration-500",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}>
              {displayContent.title}
            </h1>
            <p className={cn(
              "text-muted-foreground text-sm mb-8 transition-opacity duration-500",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}>
              {displayContent.contentType === "movie" ? "Movie" : "TV Series"}
            </p>

            {/* Children (profile grid) */}
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop variant - matching hero banner dimensions
  return (
    <div className="min-h-screen h-[85vh] relative overflow-hidden">
      {/* Background Image - Backdrop for desktop */}
      <div className="absolute inset-0">
        <img
          src={imageUrl || displayContent.mobileImageUrl}
          alt={displayContent.title}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
        />
        {/* Dark gradient overlay - stronger on left for profiles, matching hero banner */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex">
        {/* Left side - Logo and Profiles */}
        <div className="flex-1 flex flex-col p-8 lg:p-12 max-w-xl">
          {/* Logo */}
          <Logo className="mb-8" />

          {/* Profiles section */}
          <div className="flex-1 flex flex-col justify-center">
            {children}
          </div>
        </div>

        {/* Right side - spacer */}
        <div className="flex-1" />

        {/* Title - bottom right */}
        <div className="absolute bottom-12 right-12 text-right max-w-lg">
          <h1 className={cn(
            "text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-foreground uppercase tracking-tight drop-shadow-2xl transition-opacity duration-500",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}>
            {displayContent.title}
          </h1>
          <p className={cn(
            "text-muted-foreground text-lg mt-2 transition-opacity duration-500",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}>
            {displayContent.contentType === "movie" ? "Movie" : "TV Series"}
          </p>
        </div>
      </div>
    </div>
  );
};
