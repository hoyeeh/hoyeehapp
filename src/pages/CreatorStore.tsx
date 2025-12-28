import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePaidContentForStore, usePaidContentGenres, usePriceRange, useVerifyPurchase, useTrendingContent } from "@/hooks/usePaidContent";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { Sidebar } from "@/components/Sidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PurchaseModal } from "@/components/creator/PurchaseModal";
import { FeaturedCreatorCarousel } from "@/components/creator-store/FeaturedCreatorCarousel";
import { CreatorAvatarRow } from "@/components/creator-store/CreatorAvatarRow";
import { ContentRow } from "@/components/creator-store/ContentRow";
import { EnhancedContentCard } from "@/components/creator-store/EnhancedContentCard";
import { GenreFilterChips } from "@/components/creator-store/GenreFilterChips";
import { Search, ShoppingBag, ArrowLeft, SlidersHorizontal, X, Flame, Sparkles } from "lucide-react";

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
  const [showBrowseAll, setShowBrowseAll] = useState(false);

  const { data: priceRangeData } = usePriceRange();
  const { data: genres = [] } = usePaidContentGenres();
  const { data: paidContent = [], isLoading } = usePaidContentForStore({
    creatorId: selectedCreator || undefined,
    genre: selectedGenre || undefined,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    sortBy,
  });
  const { data: trendingContent = [] } = useTrendingContent();
  const verifyPurchase = useVerifyPurchase();

  // Handle payment verification from redirect
  useEffect(() => {
    const txRef = searchParams.get('tx_ref');
    const status = searchParams.get('status');
    
    if (txRef && status === 'successful') {
      verifyPurchase.mutate(txRef);
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
  const filteredContent = useMemo(() => {
    return paidContent.filter((item: any) =>
      item.content?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creator_profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [paidContent, searchQuery]);

  // Categorized content
  const newReleases = useMemo(() => {
    return [...paidContent]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12);
  }, [paidContent]);

  const bestSellers = useMemo(() => {
    return [...paidContent]
      .sort((a: any, b: any) => (b.sale_count || 0) - (a.sale_count || 0))
      .slice(0, 12);
  }, [paidContent]);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const hasActiveFilters = selectedCreator || selectedGenre || sortBy !== 'recent';

  const clearFilters = () => {
    setSelectedCreator("");
    setSelectedGenre("");
    setPriceRange([priceRangeData?.min || 0, priceRangeData?.max || 50000]);
    setSortBy('recent');
  };

  const FilterControls = () => (
    <div className="space-y-6">
      {/* Genre Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Genre</label>
        <Select value={selectedGenre || "all"} onValueChange={(v) => setSelectedGenre(v === "all" ? "" : v)}>
          <SelectTrigger className="bg-card/50">
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
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Price Range
        </label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatPrice(priceRange[0], 'XAF')}</span>
          <span className="flex-1 text-center">—</span>
          <span>{formatPrice(priceRange[1], 'XAF')}</span>
        </div>
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
        <label className="text-sm font-medium text-foreground">Sort By</label>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="bg-card/50">
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

      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Sign in to browse</h2>
          <p className="text-muted-foreground max-w-sm">
            Create an account to explore exclusive creator content
          </p>
          <Button onClick={() => navigate('/auth')} size="lg" className="mt-4">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card/50 border-border/50"
              />
            </div>
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <FilterControls />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="pt-20 space-y-8">
          {/* Hero Carousel */}
          <div className="px-4">
            <FeaturedCreatorCarousel />
          </div>

          {/* Popular Creators */}
          <section className="px-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Popular Creators
            </h2>
            <CreatorAvatarRow 
              selectedCreator={selectedCreator} 
              onSelectCreator={setSelectedCreator} 
            />
          </section>

          {/* Search Results or Browse */}
          {searchQuery ? (
            <section className="px-4">
              <h2 className="text-lg font-bold mb-4">
                Search Results ({filteredContent.length})
              </h2>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No content found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredContent.map((item: any) => (
                    <EnhancedContentCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Genre Filter Chips */}
              <section className="px-4">
                <GenreFilterChips 
                  selectedGenre={selectedGenre} 
                  onSelectGenre={setSelectedGenre} 
                />
              </section>

              {/* Trending Now */}
              {trendingContent.length > 0 && (
                <section className="px-4">
                  <ContentRow
                    title="🔥 Trending Now"
                    items={trendingContent}
                    onItemClick={setSelectedContent}
                    showSeeAll={false}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* New Releases */}
              {newReleases.length > 0 && (
                <section className="px-4">
                  <ContentRow
                    title="New Releases"
                    items={newReleases}
                    onItemClick={setSelectedContent}
                    onSeeAll={() => {
                      setSortBy('recent');
                      setShowBrowseAll(true);
                    }}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* Best Sellers */}
              {bestSellers.length > 0 && (
                <section className="px-4">
                  <ContentRow
                    title="Best Sellers"
                    items={bestSellers}
                    onItemClick={setSelectedContent}
                    onSeeAll={() => {
                      setSortBy('sales');
                      setShowBrowseAll(true);
                    }}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* Browse All Grid */}
              <section className="px-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Browse All</h2>
                  <span className="text-sm text-muted-foreground">
                    {filteredContent.length} items
                  </span>
                </div>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredContent.slice(0, showBrowseAll ? undefined : 6).map((item: any) => (
                      <EnhancedContentCard
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedContent(item)}
                      />
                    ))}
                  </div>
                )}
                {!showBrowseAll && filteredContent.length > 6 && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => setShowBrowseAll(true)}
                  >
                    Show All ({filteredContent.length})
                  </Button>
                )}
              </section>
            </>
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

      <main className="ml-16 md:ml-64">
        {/* Hero Section */}
        <div className="p-6 pb-0">
          <FeaturedCreatorCarousel />
        </div>

        <div className="p-6 space-y-10">
          {/* Header with Search */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Hoyeeh Studio</h1>
                <p className="text-muted-foreground text-sm">
                  Exclusive content from verified creators
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content or creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card/50 border-border/50"
                />
              </div>
            </div>
          </div>

          {/* Popular Creators Row */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Popular Creators
            </h2>
            <CreatorAvatarRow 
              selectedCreator={selectedCreator} 
              onSelectCreator={setSelectedCreator} 
            />
          </section>

          {/* Search Results or Content Rows */}
          {searchQuery ? (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Search Results
                </h2>
                <span className="text-sm text-muted-foreground">
                  {filteredContent.length} items found
                </span>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-12 bg-card/30 rounded-2xl">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No content found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredContent.map((item: any) => (
                    <EnhancedContentCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Genre Filter Chips */}
              <section>
                <GenreFilterChips 
                  selectedGenre={selectedGenre} 
                  onSelectGenre={setSelectedGenre} 
                />
              </section>

              {/* Trending Now */}
              {trendingContent.length > 0 && (
                <section>
                  <ContentRow
                    title="🔥 Trending Now"
                    items={trendingContent}
                    onItemClick={setSelectedContent}
                    showSeeAll={false}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* New Releases */}
              {newReleases.length > 0 && (
                <section>
                  <ContentRow
                    title="New Releases"
                    items={newReleases}
                    onItemClick={setSelectedContent}
                    onSeeAll={() => setSortBy('recent')}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* Best Sellers */}
              {bestSellers.length > 0 && (
                <section>
                  <ContentRow
                    title="Best Sellers"
                    items={bestSellers}
                    onItemClick={setSelectedContent}
                    onSeeAll={() => setSortBy('sales')}
                    cardVariant="large"
                  />
                </section>
              )}

              {/* Browse All Section */}
              <section className="mt-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Browse All</h2>
                  <div className="flex items-center gap-4">
                    {/* Inline Filters */}
                    <Select value={selectedGenre || "all"} onValueChange={(v) => setSelectedGenre(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-40 bg-card/50">
                        <SelectValue placeholder="All Genres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genres</SelectItem>
                        {genres.map((genre) => (
                          <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="w-40 bg-card/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Most Recent</SelectItem>
                        <SelectItem value="sales">Best Selling</SelectItem>
                        <SelectItem value="price_asc">Price: Low to High</SelectItem>
                        <SelectItem value="price_desc">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      {filteredContent.length} items
                    </span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : filteredContent.length === 0 ? (
                  <div className="text-center py-12 bg-card/30 rounded-2xl border border-border/50">
                    <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">No content found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredContent.map((item: any) => (
                      <EnhancedContentCard
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedContent(item)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
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
