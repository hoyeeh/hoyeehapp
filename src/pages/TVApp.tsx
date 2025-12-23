import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  Home,
  Search,
  Settings,
  User,
  Film,
  Tv as TvIcon,
  Star,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toCdnUrl } from '@/utils/cdnUrl';

interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
  genre: string | null;
  year: number | null;
  description: string | null;
}

interface FocusPosition {
  section: number;
  item: number;
}

// 10-foot UI design with large touch targets and high contrast
export default function TVApp() {
  const navigate = useNavigate();
  const [focusPosition, setFocusPosition] = useState<FocusPosition>({ section: 0, item: 0 });
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  const itemsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch content sections
  const { data: trendingContent = [] } = useQuery({
    queryKey: ['tv-trending'],
    queryFn: async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  const { data: moviesContent = [] } = useQuery({
    queryKey: ['tv-movies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('content_type', 'movie')
        .limit(10);
      return data || [];
    }
  });

  const { data: seriesContent = [] } = useQuery({
    queryKey: ['tv-series'],
    queryFn: async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('content_type', 'series')
        .limit(10);
      return data || [];
    }
  });

  const sections = [
    { id: 'trending', title: 'Trending Now', icon: TrendingUp, items: trendingContent },
    { id: 'movies', title: 'Movies', icon: Film, items: moviesContent },
    { id: 'series', title: 'TV Series', icon: TvIcon, items: seriesContent },
  ];

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentSection = sections[focusPosition.section];
    if (!currentSection) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (focusPosition.section > 0) {
          setFocusPosition(prev => ({ ...prev, section: prev.section - 1, item: 0 }));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (focusPosition.section < sections.length - 1) {
          setFocusPosition(prev => ({ ...prev, section: prev.section + 1, item: 0 }));
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (focusPosition.item > 0) {
          setFocusPosition(prev => ({ ...prev, item: prev.item - 1 }));
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (focusPosition.item < currentSection.items.length - 1) {
          setFocusPosition(prev => ({ ...prev, item: prev.item + 1 }));
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        const item = currentSection.items[focusPosition.item];
        if (item) {
          setSelectedContent(item);
        }
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        if (selectedContent) {
          setSelectedContent(null);
        }
        break;
    }
  }, [focusPosition, sections, selectedContent]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused item into view
  useEffect(() => {
    const key = `${focusPosition.section}-${focusPosition.item}`;
    const element = itemsRef.current.get(key);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      element.focus();
    }
  }, [focusPosition]);

  const handlePlayContent = (content: ContentItem) => {
    // In TV app, we'd typically handle playback differently
    // For now, navigate to content detail
    navigate(`/content/${content.id}`);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* TV Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/80 to-transparent py-8 px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold text-orange-500 tracking-tight">HOYEEH</span>
            <span className="text-2xl text-white/50 font-light">TV</span>
          </div>
          
          {/* Navigation Icons - Large for TV */}
          <nav className="flex items-center gap-8">
            <button className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors focus:text-orange-500 focus:outline-none">
              <Home className="h-8 w-8" />
              <span className="text-sm font-medium">Home</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors focus:text-orange-500 focus:outline-none">
              <Search className="h-8 w-8" />
              <span className="text-sm font-medium">Search</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors focus:text-orange-500 focus:outline-none">
              <User className="h-8 w-8" />
              <span className="text-sm font-medium">Profile</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors focus:text-orange-500 focus:outline-none">
              <Settings className="h-8 w-8" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      {trendingContent[0] && !selectedContent && (
        <section className="relative h-[70vh] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${toCdnUrl(trendingContent[0].thumbnail_url || '')})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          <div className="relative h-full flex items-center px-12">
            <div className="max-w-2xl space-y-6">
              <h1 className="text-6xl font-bold leading-tight">{trendingContent[0].title}</h1>
              <div className="flex items-center gap-4 text-xl text-white/70">
                {trendingContent[0].year && <span>{trendingContent[0].year}</span>}
                {trendingContent[0].genre && <span>• {trendingContent[0].genre}</span>}
                {trendingContent[0].content_type && (
                  <span className="px-3 py-1 rounded bg-white/20 text-sm uppercase">
                    {trendingContent[0].content_type}
                  </span>
                )}
              </div>
              <p className="text-xl text-white/80 line-clamp-3 leading-relaxed">
                {trendingContent[0].description}
              </p>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handlePlayContent(trendingContent[0])}
                  className="flex items-center gap-3 px-10 py-5 bg-white text-black rounded-lg text-xl font-bold hover:bg-white/90 transition-colors focus:ring-4 focus:ring-orange-500 focus:outline-none"
                >
                  <Play className="h-8 w-8" fill="black" />
                  Play
                </button>
                <button className="flex items-center gap-3 px-10 py-5 bg-white/20 rounded-lg text-xl font-medium hover:bg-white/30 transition-colors focus:ring-4 focus:ring-orange-500 focus:outline-none">
                  More Info
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content Sections */}
      <main className={cn(
        "relative z-10 px-12 pb-20 space-y-12",
        !selectedContent && trendingContent[0] ? "-mt-32" : "pt-32"
      )}>
        {sections.map((section, sectionIndex) => (
          <section 
            key={section.id}
            ref={(el: HTMLDivElement | null) => { if (el) sectionsRef.current[sectionIndex] = el; }}
            className="space-y-4"
          >
            <div className="flex items-center gap-4">
              <section.icon className="h-8 w-8 text-orange-500" />
              <h2 className="text-3xl font-bold">{section.title}</h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {section.items.map((item, itemIndex) => {
                const isFocused = focusPosition.section === sectionIndex && focusPosition.item === itemIndex;
                const key = `${sectionIndex}-${itemIndex}`;
                
                return (
                  <button
                    key={item.id}
                    ref={(el: HTMLButtonElement | null) => { if (el) itemsRef.current.set(key, el); }}
                    onClick={() => setSelectedContent(item)}
                    onFocus={() => setFocusPosition({ section: sectionIndex, item: itemIndex })}
                    className={cn(
                      "flex-shrink-0 relative group transition-all duration-300 focus:outline-none rounded-lg overflow-hidden",
                      isFocused 
                        ? "scale-110 ring-4 ring-orange-500 z-10" 
                        : "hover:scale-105"
                    )}
                    style={{ width: '280px', height: '160px' }}
                  >
                    <img
                      src={toCdnUrl(item.thumbnail_url || '/placeholder.svg')}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity",
                      isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )} />
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 p-4 transition-transform",
                      isFocused ? "translate-y-0" : "translate-y-full group-hover:translate-y-0"
                    )}>
                      <h3 className="font-bold text-lg truncate">{item.title}</h3>
                      <p className="text-sm text-white/70">{item.year}</p>
                    </div>
                    
                    {/* Play indicator on focus */}
                    {isFocused && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center">
                          <Play className="h-8 w-8 text-white" fill="white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {/* Content Detail Modal */}
      {selectedContent && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-12 animate-fade-in">
          <div className="max-w-5xl w-full grid grid-cols-2 gap-12">
            {/* Poster */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={toCdnUrl(selectedContent.thumbnail_url || '/placeholder.svg')}
                alt={selectedContent.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Info */}
            <div className="flex flex-col justify-center space-y-8">
              <button 
                onClick={() => setSelectedContent(null)}
                className="self-start flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xl"
              >
                <ChevronLeft className="h-8 w-8" />
                Back
              </button>
              
              <h1 className="text-5xl font-bold">{selectedContent.title}</h1>
              
              <div className="flex items-center gap-6 text-xl text-white/70">
                {selectedContent.year && <span>{selectedContent.year}</span>}
                {selectedContent.genre && <span>• {selectedContent.genre}</span>}
                <span className="px-4 py-2 rounded bg-white/20 text-base uppercase">
                  {selectedContent.content_type}
                </span>
              </div>
              
              <p className="text-xl text-white/80 leading-relaxed">
                {selectedContent.description || 'No description available.'}
              </p>
              
              <div className="flex gap-6 pt-4">
                <button 
                  onClick={() => handlePlayContent(selectedContent)}
                  className="flex items-center gap-4 px-12 py-6 bg-orange-500 rounded-xl text-2xl font-bold hover:bg-orange-600 transition-colors focus:ring-4 focus:ring-white focus:outline-none"
                >
                  <Play className="h-10 w-10" fill="white" />
                  Play Now
                </button>
                <button className="flex items-center gap-4 px-12 py-6 bg-white/20 rounded-xl text-2xl font-medium hover:bg-white/30 transition-colors focus:ring-4 focus:ring-white focus:outline-none">
                  <Clock className="h-8 w-8" />
                  Add to List
                </button>
              </div>
            </div>
          </div>
          
          {/* Navigation hints */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 text-white/50 text-lg">
            <div className="flex items-center gap-2">
              <kbd className="px-3 py-1 rounded bg-white/20">←</kbd>
              <kbd className="px-3 py-1 rounded bg-white/20">→</kbd>
              <kbd className="px-3 py-1 rounded bg-white/20">↑</kbd>
              <kbd className="px-3 py-1 rounded bg-white/20">↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-3 py-1 rounded bg-white/20">Enter</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-3 py-1 rounded bg-white/20">Esc</kbd>
              <span>Back</span>
            </div>
          </div>
        </div>
      )}

      {/* Remote Control Hints (always visible) */}
      {!selectedContent && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 text-white/40 text-base z-50 bg-black/50 px-8 py-4 rounded-full backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <ChevronLeft className="h-5 w-5" />
              <ChevronRight className="h-5 w-5" />
              <ChevronUp className="h-5 w-5" />
              <ChevronDown className="h-5 w-5" />
            </div>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-white/20 text-sm">OK</span>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-white/20 text-sm">Back</span>
            <span>Return</span>
          </div>
        </div>
      )}
    </div>
  );
}
