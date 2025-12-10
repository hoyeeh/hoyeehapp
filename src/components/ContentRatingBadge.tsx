import { cn } from "@/lib/utils";

interface ContentRatingBadgeProps {
  rating: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const RATING_COLORS: Record<string, string> = {
  G: "bg-green-600",
  PG: "bg-green-500",
  "PG-13": "bg-yellow-500",
  R: "bg-orange-500",
  "NC-17": "bg-red-500",
};

const RATING_DESCRIPTIONS: Record<string, string> = {
  G: "General Audiences",
  PG: "Parental Guidance Suggested",
  "PG-13": "Parents Strongly Cautioned",
  R: "Restricted",
  "NC-17": "Adults Only",
};

export const ContentRatingBadge = ({ 
  rating, 
  className,
  size = "sm" 
}: ContentRatingBadgeProps) => {
  if (!rating) return null;

  const normalizedRating = rating.toUpperCase();
  const bgColor = RATING_COLORS[normalizedRating] || "bg-muted";
  
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-bold rounded text-white uppercase tracking-wide",
        bgColor,
        sizeClasses[size],
        className
      )}
      title={RATING_DESCRIPTIONS[normalizedRating]}
    >
      {normalizedRating}
    </span>
  );
};

// Helper to check if content is restricted for kids profiles
export const isRestrictedForKids = (contentRating: string | null | undefined): boolean => {
  if (!contentRating) return false;
  const rating = contentRating.toUpperCase();
  // Kids profiles only allow G and PG
  return !["G", "PG"].includes(rating);
};

// Helper to check if content is restricted based on parental controls
export const isRestrictedByParentalControls = (
  contentRating: string | null | undefined,
  parentalRatingLimit: string | null | undefined
): boolean => {
  if (!contentRating || !parentalRatingLimit) return false;
  
  const ratingOrder = ["G", "PG", "PG-13", "R", "NC-17"];
  const contentIndex = ratingOrder.indexOf(contentRating.toUpperCase());
  const limitIndex = ratingOrder.indexOf(parentalRatingLimit.toUpperCase());
  
  if (contentIndex === -1 || limitIndex === -1) return false;
  
  return contentIndex > limitIndex;
};
