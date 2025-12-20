import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonicalUrl?: string;
  type?: 'website' | 'video.movie' | 'video.tv_show' | 'article';
  keywords?: string[];
  // Movie/Show specific
  releaseDate?: string;
  duration?: number;
  rating?: string;
  director?: string;
  actors?: string[];
  genre?: string;
  // Additional meta
  noindex?: boolean;
  author?: string;
}

const BASE_URL = 'https://hoyeeh.com';

// Helper to generate canonical URL from path
export const getCanonicalUrl = (path: string): string => {
  // Remove query params and trailing slashes for canonical
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  return `${BASE_URL}${cleanPath}`;
};

export const useSEO = ({
  title,
  description,
  image,
  url,
  canonicalUrl,
  type = 'website',
  keywords = [],
  releaseDate,
  duration,
  rating,
  director,
  actors = [],
  genre,
  noindex = false,
  author,
}: SEOProps) => {
  const location = useLocation();
  useEffect(() => {
    const baseTitle = 'Hoyeeh';
    const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;
    
    // Update document title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Helper to update or create link tag
    const setLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Canonical URL - use provided or generate from current path
    const canonical = canonicalUrl || url || getCanonicalUrl(location.pathname);
    setLink('canonical', canonical);

    // Robots meta
    if (noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // Basic meta tags
    if (description) {
      setMeta('description', description);
    }

    if (keywords.length > 0) {
      setMeta('keywords', keywords.join(', '));
    }

    if (author) {
      setMeta('author', author);
    }

    // Open Graph tags
    setMeta('og:title', fullTitle, true);
    setMeta('og:type', type, true);
    
    if (description) {
      setMeta('og:description', description, true);
    }
    
    if (image) {
      setMeta('og:image', image, true);
      setMeta('og:image:width', '1200', true);
      setMeta('og:image:height', '630', true);
    }
    
    if (url) {
      setMeta('og:url', url, true);
    }

    setMeta('og:site_name', 'Hoyeeh', true);

    // Twitter Card tags
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    
    if (description) {
      setMeta('twitter:description', description);
    }
    
    if (image) {
      setMeta('twitter:image', image);
    }

    // Video-specific meta tags
    if (type === 'video.movie' || type === 'video.tv_show') {
      if (releaseDate) {
        setMeta('video:release_date', releaseDate, true);
      }
      if (duration) {
        setMeta('video:duration', duration.toString(), true);
      }
      if (director) {
        setMeta('video:director', director, true);
      }
      actors.forEach((actor, index) => {
        setMeta(`video:actor:${index}`, actor, true);
      });
    }

    // Structured data for video content
    if ((type === 'video.movie' || type === 'video.tv_show') && title) {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': type === 'video.movie' ? 'Movie' : 'TVSeries',
        name: title,
        description: description || '',
        image: image || '',
        ...(releaseDate && { datePublished: releaseDate }),
        ...(duration && { duration: `PT${Math.floor(duration / 60)}M` }),
        ...(rating && { 
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            bestRating: '10',
            worstRating: '0',
          }
        }),
        ...(director && { 
          director: {
            '@type': 'Person',
            name: director,
          }
        }),
        ...(actors.length > 0 && {
          actor: actors.map(name => ({
            '@type': 'Person',
            name,
          })),
        }),
        ...(genre && { genre }),
        provider: {
          '@type': 'Organization',
          name: 'Hoyeeh',
          url: 'https://hoyeeh.com',
        },
      };

      let scriptTag = document.querySelector('script[data-seo-structured]') as HTMLScriptElement;
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.type = 'application/ld+json';
        scriptTag.setAttribute('data-seo-structured', 'true');
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(structuredData);
    }

    // Cleanup function
    return () => {
      // Remove structured data on unmount
      const scriptTag = document.querySelector('script[data-seo-structured]');
      if (scriptTag) {
        scriptTag.remove();
      }
    };
  }, [title, description, image, url, type, keywords, releaseDate, duration, rating, director, actors, genre]);
};
