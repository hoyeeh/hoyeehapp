import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HomepageAd } from '@/hooks/useHomepageAds';
import { SpotlightAdPlayer } from './SpotlightAdPlayer';
interface SpotlightAdCarouselProps {
  ads: HomepageAd[];
  appContext?: 'main' | 'kids' | 'tv';
}

const ROTATION_INTERVAL = 12000; // 12 seconds

export function SpotlightAdCarousel({ ads, appContext = 'main' }: SpotlightAdCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection Observer for in-view detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting && entry.intersectionRatio >= 0.6);
      },
      {
        threshold: [0, 0.3, 0.6, 1],
        rootMargin: '0px',
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Auto-rotation when in view
  useEffect(() => {
    if (ads.length <= 1) return;

    if (isInView) {
      rotationTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % ads.length);
      }, ROTATION_INTERVAL);
    } else {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
    }

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [isInView, ads.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
    // Reset rotation timer
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      if (isInView) {
        rotationTimerRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % ads.length);
        }, ROTATION_INTERVAL);
      }
    }
  }, [ads.length, isInView]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % ads.length);
    // Reset rotation timer
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      if (isInView) {
        rotationTimerRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % ads.length);
        }, ROTATION_INTERVAL);
      }
    }
  }, [ads.length, isInView]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    // Reset rotation timer
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      if (isInView) {
        rotationTimerRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % ads.length);
        }, ROTATION_INTERVAL);
      }
    }
  }, [ads.length, isInView]);

  if (!ads.length) return null;

  const currentAd = ads[currentIndex];

  return (
    <section ref={containerRef} className="relative w-full px-4 md:px-6 lg:px-8 py-4">
      <div className="relative">
        {/* Current Ad */}
        <SpotlightAdPlayer
          key={currentAd.id}
          ad={currentAd}
          isInView={isInView}
          appContext={appContext}
        />

        {/* Navigation Arrows (only if multiple ads) */}
        {ads.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
              aria-label="Previous ad"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
              aria-label="Next ad"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {ads.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {ads.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex
                    ? "bg-white w-6"
                    : "bg-white/50 hover:bg-white/70"
                )}
                aria-label={`Go to ad ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
