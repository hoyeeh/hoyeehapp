import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface CrazyGame {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  embedUrl: string;
  category: string;
  tags: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || "";
    const page = parseInt(url.searchParams.get("page") || "1");

    // CrazyGames popular games catalog (curated list of kid-friendly games)
    const gamesDatabase: CrazyGame[] = [
      {
        slug: "cut-the-rope-ebx",
        title: "Cut the Rope",
        description: "Cut the rope to feed candy to the little monster Om Nom!",
        thumbnailUrl: "https://images.crazygames.com/cut-the-rope-ebx/20220114153910/cut-the-rope-ebx-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/cut-the-rope-ebx",
        category: "Puzzle",
        tags: ["puzzle", "physics", "casual", "kids"]
      },
      {
        slug: "moto-x3m",
        title: "Moto X3M",
        description: "Race your motorbike through challenging obstacle courses!",
        thumbnailUrl: "https://images.crazygames.com/moto-x3m/20220111145231/moto-x3m-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/moto-x3m",
        category: "Racing",
        tags: ["racing", "motorbike", "stunts", "action"]
      },
      {
        slug: "12-minibattles",
        title: "12 MiniBattles",
        description: "Compete in 12 fun mini games against a friend!",
        thumbnailUrl: "https://images.crazygames.com/12-minibattles/20211215094900/12-minibattles-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/12-minibattles",
        category: "2 Player",
        tags: ["2-player", "multiplayer", "party", "fun"]
      },
      {
        slug: "run-3",
        title: "Run 3",
        description: "Run and jump through space tunnels in this endless runner!",
        thumbnailUrl: "https://images.crazygames.com/run-3/20211013090051/run-3-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/run-3",
        category: "Running",
        tags: ["running", "endless", "space", "arcade"]
      },
      {
        slug: "slope",
        title: "Slope",
        description: "Control a ball rolling down a steep slope!",
        thumbnailUrl: "https://images.crazygames.com/slope/20220111160353/slope-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/slope",
        category: "Running",
        tags: ["endless", "ball", "3d", "arcade"]
      },
      {
        slug: "subway-surfers",
        title: "Subway Surfers",
        description: "Dash through the subway and escape the grumpy inspector!",
        thumbnailUrl: "https://images.crazygames.com/subway-surfers/20230126153510/subway-surfers-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/subway-surfers",
        category: "Running",
        tags: ["running", "endless", "arcade", "popular"]
      },
      {
        slug: "temple-run-2",
        title: "Temple Run 2",
        description: "Run for your life and escape the temple!",
        thumbnailUrl: "https://images.crazygames.com/temple-run-2/20230308170706/temple-run-2-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/temple-run-2",
        category: "Running",
        tags: ["running", "endless", "adventure", "action"]
      },
      {
        slug: "geometry-dash",
        title: "Geometry Dash",
        description: "Jump and fly through danger in this rhythm-based platformer!",
        thumbnailUrl: "https://images.crazygames.com/geometry-dash/20211013091447/geometry-dash-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/geometry-dash",
        category: "Arcade",
        tags: ["rhythm", "platformer", "music", "challenging"]
      },
      {
        slug: "stickman-hook",
        title: "Stickman Hook",
        description: "Swing from hook to hook like a stickman Spider-Man!",
        thumbnailUrl: "https://images.crazygames.com/stickman-hook/20211013091630/stickman-hook-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/stickman-hook",
        category: "Arcade",
        tags: ["stickman", "swinging", "physics", "fun"]
      },
      {
        slug: "dino-game",
        title: "Dino Game",
        description: "The famous Chrome dinosaur game!",
        thumbnailUrl: "https://images.crazygames.com/dino-game/20211013090411/dino-game-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/dino-game",
        category: "Arcade",
        tags: ["dinosaur", "jumping", "endless", "retro"]
      },
      {
        slug: "basketball-stars",
        title: "Basketball Stars",
        description: "Show off your basketball skills in this multiplayer game!",
        thumbnailUrl: "https://images.crazygames.com/basketball-stars/20220111144635/basketball-stars-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/basketball-stars",
        category: "Sports",
        tags: ["basketball", "sports", "multiplayer", "competitive"]
      },
      {
        slug: "paper-io-2",
        title: "Paper.io 2",
        description: "Conquer as much territory as possible!",
        thumbnailUrl: "https://images.crazygames.com/paper-io-2/20211013091259/paper-io-2-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/paper-io-2",
        category: "IO",
        tags: ["io", "territory", "multiplayer", "casual"]
      },
      {
        slug: "agar-io",
        title: "Agar.io",
        description: "Eat cells and grow bigger in this multiplayer game!",
        thumbnailUrl: "https://images.crazygames.com/agar-io/20220524160422/agar-io-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/agar-io",
        category: "IO",
        tags: ["io", "multiplayer", "eating", "strategy"]
      },
      {
        slug: "snake-io",
        title: "Snake.io",
        description: "Become the biggest snake in the arena!",
        thumbnailUrl: "https://images.crazygames.com/snake-io/20211013091620/snake-io-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/snake-io",
        category: "IO",
        tags: ["io", "snake", "multiplayer", "arcade"]
      },
      {
        slug: "fireboy-and-watergirl-in-the-forest-temple",
        title: "Fireboy and Watergirl: Forest Temple",
        description: "Solve puzzles with Fireboy and Watergirl in the forest!",
        thumbnailUrl: "https://images.crazygames.com/fireboy-and-watergirl-in-the-forest-temple/20211013090710/fireboy-and-watergirl-in-the-forest-temple-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/fireboy-and-watergirl-in-the-forest-temple",
        category: "2 Player",
        tags: ["2-player", "puzzle", "cooperative", "adventure"]
      },
      {
        slug: "crossy-road",
        title: "Crossy Road",
        description: "Help the chicken cross the road safely!",
        thumbnailUrl: "https://images.crazygames.com/crossy-road/20230130143627/crossy-road-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/crossy-road",
        category: "Arcade",
        tags: ["arcade", "casual", "endless", "chicken"]
      },
      {
        slug: "flappy-bird",
        title: "Flappy Bird",
        description: "Tap to fly through the pipes!",
        thumbnailUrl: "https://images.crazygames.com/flappy-bird/20211013090645/flappy-bird-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/flappy-bird",
        category: "Arcade",
        tags: ["arcade", "tapping", "bird", "challenging"]
      },
      {
        slug: "2048",
        title: "2048",
        description: "Combine tiles to reach the 2048 tile!",
        thumbnailUrl: "https://images.crazygames.com/2048/20211013085928/2048-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/2048",
        category: "Puzzle",
        tags: ["puzzle", "numbers", "brain", "casual"]
      },
      {
        slug: "stack",
        title: "Stack",
        description: "Stack blocks to build the highest tower!",
        thumbnailUrl: "https://images.crazygames.com/stack/20211013091637/stack-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/stack",
        category: "Arcade",
        tags: ["arcade", "building", "timing", "casual"]
      },
      {
        slug: "among-us-single-player",
        title: "Among Us Single Player",
        description: "Play Among Us solo and find the imposter!",
        thumbnailUrl: "https://images.crazygames.com/among-us-single-player/20211013085950/among-us-single-player-cover?auto=format,compress&q=75&cs=strip",
        embedUrl: "https://www.crazygames.com/embed/among-us-single-player",
        category: "Puzzle",
        tags: ["puzzle", "detective", "space", "fun"]
      },
    ];

    // Filter games based on search query and category
    let results = gamesDatabase;

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(game => 
        game.title.toLowerCase().includes(lowerQuery) ||
        game.description.toLowerCase().includes(lowerQuery) ||
        game.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    if (category) {
      const lowerCategory = category.toLowerCase();
      results = results.filter(game => 
        game.category.toLowerCase() === lowerCategory ||
        game.tags.some(tag => tag.toLowerCase() === lowerCategory)
      );
    }

    // Pagination
    const pageSize = 12;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    // Get unique categories
    const categories = [...new Set(gamesDatabase.map(g => g.category))].sort();

    return new Response(
      JSON.stringify({
        games: paginatedResults,
        total: results.length,
        page,
        pageSize,
        totalPages: Math.ceil(results.length / pageSize),
        categories,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Search error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
