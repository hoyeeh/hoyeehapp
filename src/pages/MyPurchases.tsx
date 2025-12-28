import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPurchases } from "@/hooks/usePaidContent";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, ShoppingBag, User, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function MyPurchases() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: purchases = [], isLoading } = useUserPurchases();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Sign in to view purchases</h1>
        <p className="text-muted-foreground mb-6 text-center">
          You need to be signed in to view your purchased content.
        </p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">My Purchases</h1>
            <p className="text-sm text-muted-foreground">
              {purchases.length} {purchases.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ShoppingBag className="h-20 w-20 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold mb-2">No purchases yet</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              You haven't purchased any content from creators yet. Explore the creator store to find amazing content!
            </p>
            <Button onClick={() => navigate("/creator-store")} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Explore Creator Store
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchases.map((purchase: any) => (
              <div
                key={purchase.id}
                className="bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => navigate(`/content/${purchase.content?.id}`)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video">
                  <img
                    src={purchase.content?.thumbnail_url || '/placeholder.svg'}
                    alt={purchase.content?.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                      <Play className="h-6 w-6 text-primary-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Badge */}
                  <Badge className="absolute top-3 right-3 bg-green-600">
                    Purchased
                  </Badge>
                </div>

                {/* Content Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                      {purchase.content?.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {purchase.content?.content_type === 'series' ? 'TV Series' : 'Movie'}
                      </Badge>
                      {purchase.content?.genre && (
                        <span className="text-xs text-muted-foreground">
                          {purchase.content.genre.split(',')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Creator */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-3 w-3" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {purchase.creator_profiles?.display_name || 'Creator'}
                    </span>
                  </div>

                  {/* Purchase details */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(purchase.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatPrice(purchase.amount, purchase.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}