import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the base URL from request or environment
    const url = new URL(req.url);
    const baseUrl = url.searchParams.get('baseUrl') || 'https://hoyeeh.com';

    console.log('[SITEMAP] Generating dynamic sitemap');

    // Fetch all public content
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, title, updated_at, content_type')
      .order('updated_at', { ascending: false });

    if (contentError) {
      console.error('[SITEMAP] Error fetching content:', contentError);
      throw contentError;
    }

    // Fetch all genres
    const { data: genres, error: genresError } = await supabase
      .from('genres')
      .select('slug, updated_at')
      .order('name');

    if (genresError) {
      console.error('[SITEMAP] Error fetching genres:', genresError);
    }

    // Fetch coming soon items
    const { data: comingSoon, error: comingSoonError } = await supabase
      .from('coming_soon')
      .select('id, updated_at')
      .eq('is_active', true);

    if (comingSoonError) {
      console.error('[SITEMAP] Error fetching coming soon:', comingSoonError);
    }

    const now = new Date().toISOString();

    // Static pages with priorities
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/genres', priority: '0.8', changefreq: 'weekly' },
      { loc: '/search', priority: '0.7', changefreq: 'daily' },
      { loc: '/subscription', priority: '0.6', changefreq: 'monthly' },
      { loc: '/about', priority: '0.5', changefreq: 'monthly' },
      { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/terms-of-use', priority: '0.3', changefreq: 'yearly' },
      { loc: '/copyright', priority: '0.3', changefreq: 'yearly' },
      { loc: '/contact', priority: '0.4', changefreq: 'monthly' },
      { loc: '/help', priority: '0.5', changefreq: 'monthly' },
      { loc: '/install', priority: '0.6', changefreq: 'monthly' },
    ];

    // Build XML sitemap
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    // Add static pages
    for (const page of staticPages) {
      xml += `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // Add content pages (movies and series)
    if (content) {
      for (const item of content) {
        const priority = item.content_type === 'series' ? '0.9' : '0.8';
        xml += `  <url>
    <loc>${baseUrl}/content/${item.id}</loc>
    <lastmod>${item.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
      }
    }

    // Add genre pages
    if (genres) {
      for (const genre of genres) {
        xml += `  <url>
    <loc>${baseUrl}/genres?genre=${genre.slug}</loc>
    <lastmod>${genre.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      }
    }

    // Add coming soon pages (if they have dedicated pages)
    if (comingSoon) {
      for (const item of comingSoon) {
        xml += `  <url>
    <loc>${baseUrl}/coming-soon/${item.id}</loc>
    <lastmod>${item.updated_at || now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
`;
      }
    }

    xml += `</urlset>`;

    console.log(`[SITEMAP] Generated sitemap with ${staticPages.length + (content?.length || 0) + (genres?.length || 0) + (comingSoon?.length || 0)} URLs`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[SITEMAP] Error generating sitemap:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://hoyeeh.com/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`,
      { headers: corsHeaders }
    );
  }
});
