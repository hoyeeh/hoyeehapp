import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Volume2, VolumeX, Play, Pause, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HomepageAd, useTrackAdEvent } from '@/hooks/useHomepageAds';
import { useNavigate } from 'react-router-dom';
import { throttle } from '@/player/core/utils/throttle';
import { useNewPlayer } from '@/hooks/useNewPlayer';
import { VideoJSPlayer } from '@/components/VideoJSPlayer';
import { NewPlayerBadge } from '@/components/dev/NewPlayerBadge';

interface SpotlightAdPlayerProps {
  ad: HomepageAd;
  isInView: boolean;
  appContext?: 'main' | 'kids' | 'tv';
}

export function SpotlightAdPlayer({ ad, isInView, appContext = 'main' }: SpotlightAdPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  
  const navigate = useNavigate();
  const trackEvent = useTrackAdEvent();

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Setup HLS if needed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad.video_url) return;

    const isHls = ad.video_type === 'hls' || ad.video_url.includes('.m3u8');
    
    if (isHls) {
      // Try to load HLS.js
      const loadHls = async () => {
        try {
          // Check if native HLS is supported (Safari)
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = ad.video_url!;
            return;
          }
          
          // Load HLS.js dynamically
          const Hls = (window as any).Hls;
          if (Hls?.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
            });
            hls.loadSource(ad.video_url!);
            hls.attachMedia(video);
            hlsRef.current = hls;
            
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) {
                setHasError(true);
                trackEvent.mutate({ adId: ad.id, eventType: 'error', appContext });
              }
            });
          } else {
            // Try native anyway
            video.src = ad.video_url!;
          }
        } catch (err) {
          console.error('Failed to setup HLS:', err);
          setHasError(true);
        }
      };
      
      loadHls();
    } else {
      video.src = ad.video_url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [ad.video_url, ad.video_type, ad.id]);

  // Track impression when in view
  useEffect(() => {
    if (isInView && !hasTrackedImpression) {
      trackEvent.mutate({ adId: ad.id, eventType: 'impression', appContext });
      setHasTrackedImpression(true);
    }
  }, [isInView, hasTrackedImpression, ad.id, appContext]);

  // Handle autoplay based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad.video_url || prefersReducedMotion || hasError) return;

    if (isInView && !isPlaying) {
      video.muted = true;
      setIsMuted(true);
      
      video.play()
        .then(() => {
          setIsPlaying(true);
          setShowPlayOverlay(false);
          trackEvent.mutate({ adId: ad.id, eventType: 'play', appContext });
        })
        .catch(() => {
          setShowPlayOverlay(true);
        });
    } else if (!isInView && isPlaying) {
      video.pause();
      setIsPlaying(false);
      trackEvent.mutate({ adId: ad.id, eventType: 'pause', appContext });
    }
  }, [isInView, isPlaying, ad.video_url, prefersReducedMotion, hasError, ad.id, appContext]);

  const handleManualPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = true;
    video.play()
      .then(() => {
        setIsPlaying(true);
        setShowPlayOverlay(false);
        trackEvent.mutate({ adId: ad.id, eventType: 'play', appContext });
      })
      .catch(console.error);
  }, [ad.id, appContext]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
    trackEvent.mutate({ 
      adId: ad.id, 
      eventType: video.muted ? 'mute' : 'unmute', 
      appContext 
    });
  }, [ad.id, appContext]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      trackEvent.mutate({ adId: ad.id, eventType: 'pause', appContext });
    } else {
      video.play()
        .then(() => {
          setIsPlaying(true);
          trackEvent.mutate({ adId: ad.id, eventType: 'play', appContext });
        })
        .catch(console.error);
    }
  }, [isPlaying, ad.id, appContext]);

  const handleCtaClick = useCallback(() => {
    trackEvent.mutate({ adId: ad.id, eventType: 'click', appContext });
    
    if (ad.cta_internal_route) {
      navigate(ad.cta_internal_route);
    } else if (ad.cta_url) {
      window.open(ad.cta_url, '_blank', 'noopener,noreferrer');
    }
  }, [ad.id, ad.cta_internal_route, ad.cta_url, appContext, navigate]);

  const handleVideoLoaded = () => setIsVideoLoaded(true);
  const handleVideoError = () => {
    setHasError(true);
    trackEvent.mutate({ adId: ad.id, eventType: 'error', appContext });
  };

  const showVideo = ad.video_url && !hasError && !prefersReducedMotion;

  return (
    <div className="relative w-full aspect-video md:aspect-[21/9] rounded-xl overflow-hidden bg-black group">
      {/* Poster Image */}
      <img
        src={ad.poster_url}
        alt={ad.title}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
          isVideoLoaded && isPlaying ? "opacity-0" : "opacity-100"
        )}
      />

      {/* Video Element */}
      {showVideo && (
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
            isVideoLoaded && isPlaying ? "opacity-100" : "opacity-0"
          )}
          poster={ad.poster_url}
          muted
          loop
          playsInline
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Ad Badge */}
      <div className="absolute top-4 left-4 px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-xs font-medium text-white/90">
        Ad
      </div>

      {/* Play Overlay (when autoplay blocked or reduced motion) */}
      {(showPlayOverlay || prefersReducedMotion) && showVideo && (
        <button
          onClick={handleManualPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-white/30 transition-colors">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
          <span className="absolute bottom-1/3 text-white/80 text-sm">
            Tap to play preview
          </span>
        </button>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-1 md:mb-2 line-clamp-2">
            {ad.title}
          </h2>
          {ad.subtitle && (
            <p className="text-sm md:text-base text-white/80 mb-3 md:mb-4 line-clamp-2">
              {ad.subtitle}
            </p>
          )}
          
          {ad.cta_label && (
            <Button
              onClick={handleCtaClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
            >
              {ad.cta_label}
              {ad.cta_url && <ExternalLink className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      {showVideo && isVideoLoaded && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
