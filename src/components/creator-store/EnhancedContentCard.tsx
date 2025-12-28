import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ShoppingBag, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedContentCardProps {
  item: any;
  onClick: () => void;
  variant?: 'default' | 'large' | 'horizontal';
}

export function EnhancedContentCard({ item, onClick, variant = 'default' }: EnhancedContentCardProps) {
  const formatPrice = (price: number, currency?: string) => {
    const currencyCode = currency || 'XAF';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (variant === 'horizontal') {
    return (
      <div
        onClick={onClick}
        className="group flex gap-4 p-3 bg-card/30 hover:bg-card/50 rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
      >
        {/* Thumbnail */}
        <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden">
          <img
            src={item.content?.thumbnail_url || '/placeholder.svg'}
            alt={item.content?.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white/50" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between py-1">
          <div>
            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {item.content?.title}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              {item.creator_profiles?.avatar_url && (
                <img
                  src={item.creator_profiles.avatar_url}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span>{item.creator_profiles?.display_name}</span>
              {item.creator_profiles?.is_verified && (
                <CheckCircle className="h-3 w-3 text-primary" />
              )}
            </div>
            {item.content?.genre && (
              <Badge variant="secondary" className="mt-2 text-[10px] py-0">
                {item.content.genre}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary text-sm">
              {formatPrice(item.price, item.currency)}
            </span>
            {item.sale_count > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {item.sale_count} sold
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300",
        "bg-card/30 border border-border/30 hover:border-primary/50",
        "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5",
        variant === 'large' ? "aspect-[2/3]" : "aspect-[2/3]"
      )}
    >
      {/* Image */}
      <div className="absolute inset-0">
        <img
          src={item.content?.thumbnail_url || '/placeholder.svg'}
          alt={item.content?.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
      </div>

      {/* Top Badges */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between z-10">
        {/* Sales Badge */}
        {item.sale_count > 10 && (
          <Badge className="bg-amber-500/90 text-black text-[10px] font-bold">
            <TrendingUp className="h-3 w-3 mr-1" />
            HOT
          </Badge>
        )}
        
        {/* Price Badge */}
        <Badge className="bg-primary text-primary-foreground font-bold ml-auto">
          {formatPrice(item.price, item.currency)}
        </Badge>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        {/* Genre Tag */}
        {item.content?.genre && (
          <Badge 
            variant="outline" 
            className="mb-2 text-[10px] border-foreground/30 text-foreground/80 bg-background/20 backdrop-blur-sm"
          >
            {item.content.genre}
          </Badge>
        )}

        {/* Title */}
        <h3 className="font-bold text-sm md:text-base text-white line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {item.content?.title}
        </h3>

        {/* Creator Info */}
        <div className="flex items-center gap-2">
          {item.creator_profiles?.avatar_url ? (
            <img
              src={item.creator_profiles.avatar_url}
              alt=""
              className="w-6 h-6 rounded-full border border-white/30"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/50 flex items-center justify-center">
              <span className="text-xs text-white font-bold">
                {item.creator_profiles?.display_name?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <span className="text-xs text-white/80 truncate flex-1">
            {item.creator_profiles?.display_name}
          </span>
          {item.creator_profiles?.is_verified && (
            <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>

        {/* Sales Count */}
        {item.sale_count > 0 && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-white/60">
            <ShoppingBag className="h-3 w-3" />
            {item.sale_count} purchases
          </div>
        )}
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Button size="sm" className="gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
          <Play className="h-4 w-4 fill-current" />
          Preview
        </Button>
      </div>
    </div>
  );
}
