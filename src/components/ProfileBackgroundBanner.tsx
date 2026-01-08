import { useProfileBackground, ProfileBackgroundContent } from "@/hooks/useProfileBackground";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

interface ProfileBackgroundBannerProps {
  children: React.ReactNode;
  variant?: "desktop" | "mobile";
}

export const ProfileBackgroundBanner = ({
  children,
  variant = "desktop",
}: ProfileBackgroundBannerProps) => {
  const { backgroundContent } = useProfileBackground();

  if (!backgroundContent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        {children}
      </div>
    );
  }

  if (variant === "mobile") {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={backgroundContent.thumbnailUrl}
            alt={backgroundContent.title}
            className="w-full h-full object-cover"
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
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground text-center tracking-tight uppercase mb-2 drop-shadow-2xl">
              {backgroundContent.title}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {backgroundContent.contentType === "movie" ? "Movie" : "TV Series"}
            </p>

            {/* Children (profile grid) */}
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop variant
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={backgroundContent.thumbnailUrl}
          alt={backgroundContent.title}
          className="w-full h-full object-cover"
        />
        {/* Dark gradient overlay - stronger on left for profiles */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex">
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
          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-foreground uppercase tracking-tight drop-shadow-2xl">
            {backgroundContent.title}
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            {backgroundContent.contentType === "movie" ? "Movie" : "TV Series"}
          </p>
        </div>
      </div>
    </div>
  );
};
