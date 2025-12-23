import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePaidContentForStore, useCreatorsWithContent, usePaidContentGenres, usePriceRange, useVerifyPurchase } from "@/hooks/usePaidContent";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PurchaseModal } from "@/components/creator/PurchaseModal";
import { Search, Filter, Star, ShoppingBag, CheckCircle, Play, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function CreatorStore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobile = isMobileDevice || isTablet;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'sales'>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);

  const { data: priceRangeData } = usePriceRange();
  const { data: creators = [] } = useCreatorsWithContent();
  const { data: genres = [] } = usePaidContentGenres();
  const { data: paidContent = [], isLoading } = usePaidContentForStore({
    creatorId: selectedCreator || undefined,
    genre: selectedGenre || undefined,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    sortBy,
  });
  const verifyPurchase = useVerifyPurchase();

  // Handle payment verification from redirect
  useEffect(() => {
    const txRef = searchParams.get('tx_ref');
    const status = searchParams.get('status');
    
    if (txRef && status === 'successful') {
      verifyPurchase.mutate(txRef);
      // Clean up URL
      navigate('/creator-store', { replace: true });
    }
  }, [searchParams]);

  // Update price range when data loads
  useEffect(() => {
    if (priceRangeData) {
      setPriceRange([priceRangeData.min, priceRangeData.max]);
    }
  }, [priceRangeData]);

  // Filter by search
  const filteredContent = paidContent.filter((item: any) =>
    item.content?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.creator_profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const FilterControls = () => (
    <div className="space-y-6">
      {/* Creator Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Creator</label>
        <Select value={selectedCreator || "all"} onValueChange={(v) => setSelectedCreator(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All Creators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            {creators.map((creator: any) => (
              <SelectItem key={creator.id} value={creator.id}>
                {creator.display_name} {creator.is_verified && "✓"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Genre Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Genre</label>
        <Select value={selectedGenre || "all"} onValueChange={(v) => setSelectedGenre(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {genres.map((genre) => (
              <SelectItem key={genre} value={genre}>{genre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Price Range: {formatPrice(priceRange[0], 'XAF')} - {formatPrice(priceRange[1], 'XAF')}
        </label>
        <Slider
          value={priceRange}
          onValueChange={(value) => setPriceRange(value as [number, number])}
          min={priceRangeData?.min || 0}
          max={priceRangeData?.max || 50000}
          step={500}
          className="mt-2"
        />
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Sort By</label>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="sales">Best Selling</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setSelectedCreator("");
          setSelectedGenre("");
          setPriceRange([priceRangeData?.min || 0, priceRangeData?.max || 50000]);
          setSortBy('recent');
        }}
      >
        Clear Filters
      </Button>
    </div>
  );

  const ContentGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {filteredContent.map((item: any) => (
        <Card 
          key={item.id} 
          className="group overflow-hidden bg-card/50 border-border/50 hover:border-primary/50 transition-all cursor-pointer"
          onClick={() => setSelectedContent(item)}
        >
          <div className="relative aspect-[2/3]">
            <img
              src={item.content?.thumbnail_url || '/placeholder.svg'}
              alt={item.content?.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            
            {/* Price Badge */}
            <div className="absolute top-2 right-2">
              <Badge className="bg-primary text-primary-foreground font-bold">
                {formatPrice(item.price, item.currency)}
              </Badge>
            </div>

            {/* Sales Badge */}
            {item.sale_count > 0 && (
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-xs">
                  {item.sale_count} sold
                </Badge>
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <Button size="sm" className="w-full gap-2">
                <ShoppingBag className="h-4 w-4" />
                Buy Now
              </Button>
            </div>
          </div>

          <CardContent className="p-3 space-y-1">
            <h3 className="font-medium text-sm truncate">{item.content?.title}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {item.creator_profiles?.avatar_url && (
                <img
                  src={item.creator_profiles.avatar_url}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span className="truncate">{item.creator_profiles?.display_name}</span>
              {item.creator_profiles?.is_verified && (
                <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold">Sign in to browse</h2>
          <p className="text-muted-foreground">Create an account to explore creator content</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creator content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <FilterControls />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="pt-20 px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Creator Store</h1>
            <span className="text-sm text-muted-foreground">
              {filteredContent.length} items
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No content found</p>
            </div>
          ) : (
            <ContentGrid />
          )}
        </main>

        <MobileBottomNav />

        {selectedContent && (
          <PurchaseModal
            open={!!selectedContent}
            onClose={() => setSelectedContent(null)}
            paidContent={selectedContent}
          />
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView="home"
        onNavigate={() => {}}
        onLogout={() => {}}
        userName=""
      />

      <main className="ml-16 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShoppingBag className="h-8 w-8 text-primary" />
                Creator Store
              </h1>
              <p className="text-muted-foreground mt-1">
                Discover exclusive content from verified creators
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredContent.length} items
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[250px_1fr] gap-6">
            {/* Sidebar Filters */}
            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </h3>
                <FilterControls />
              </Card>
            </div>

            {/* Content Grid */}
            <div>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">No content found</h3>
                  <p className="text-muted-foreground">Try adjusting your filters</p>
                </div>
              ) : (
                <ContentGrid />
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedContent && (
        <PurchaseModal
          open={!!selectedContent}
          onClose={() => setSelectedContent(null)}
          paidContent={selectedContent}
        />
      )}
    </div>
  );
}
