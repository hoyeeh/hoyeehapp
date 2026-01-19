import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ItchGame {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  embedUrl: string;
  creator: string;
  category: string;
  tags: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = 20;

    // Curated list of kid-friendly itch.io HTML5 games
    const gamesDatabase: ItchGame[] = [
      {
        slug: "celeste-classic",
        title: "Celeste Classic",
        description: "A challenging platformer about climbing a mountain",
        thumbnail: "https://img.itch.zone/aW1nLzEwNjI5MTcucG5n/315x250%23c/Ht8XsE.png",
        embedUrl: "https://html-classic.itch.zone/html/1772484/index.html",
        creator: "Matt Makes Games",
        category: "Platformer",
        tags: ["platformer", "adventure", "puzzle"]
      },
      {
        slug: "pico-8-jelpi",
        title: "Jelpi",
        description: "A fun platformer demo showcasing PICO-8",
        thumbnail: "https://img.itch.zone/aW1hZ2UvMjE0NTIvODQ0NjcucG5n/315x250%23c/iYqbKZ.png",
        embedUrl: "https://html-classic.itch.zone/html/21452/index.html",
        creator: "Lexaloffle",
        category: "Platformer",
        tags: ["platformer", "pico-8", "retro"]
      },
      {
        slug: "ducklings-io",
        title: "Ducklings.io",
        description: "Collect ducklings and grow your duck family!",
        thumbnail: "https://img.itch.zone/aW1nLzUzNjQyNDUucG5n/315x250%23c/qBPWzV.png",
        embedUrl: "https://html-classic.itch.zone/html/2647123/index.html",
        creator: "Pelican Party",
        category: "Casual",
        tags: ["casual", "cute", "animals"]
      },
      {
        slug: "the-best-game-in-the-world",
        title: "PICO Night Punkin",
        description: "A PICO-8 rhythm game demake",
        thumbnail: "https://img.itch.zone/aW1nLzU0NjA5MzQucG5n/315x250%23c/5tEGYa.png",
        embedUrl: "https://html-classic.itch.zone/html/2826073/index.html",
        creator: "RiverOaken",
        category: "Rhythm",
        tags: ["rhythm", "music", "retro"]
      },
      {
        slug: "tiny-ski",
        title: "Tiny Ski",
        description: "A cozy pixel art skiing game",
        thumbnail: "https://img.itch.zone/aW1nLzg2OTg2NzEucG5n/315x250%23c/ej%2FmPV.png",
        embedUrl: "https://html-classic.itch.zone/html/4529162/index.html",
        creator: "Bearmask Games",
        category: "Sports",
        tags: ["sports", "skiing", "pixel-art"]
      },
      {
        slug: "sokobond",
        title: "Sokobond Demo",
        description: "An elegantly designed puzzle about chemistry",
        thumbnail: "https://img.itch.zone/aW1hZ2UvMjE5OTIvOTQ0NzMucG5n/315x250%23c/V1THYL.png",
        embedUrl: "https://html-classic.itch.zone/html/21992/index.html",
        creator: "Alan Hazelden",
        category: "Puzzle",
        tags: ["puzzle", "educational", "chemistry"]
      },
      {
        slug: "hue-shift",
        title: "Hue Shift",
        description: "A colorful puzzle platformer",
        thumbnail: "https://img.itch.zone/aW1nLzI2MzU0MjMucG5n/315x250%23c/vxqLXP.png",
        embedUrl: "https://html-classic.itch.zone/html/1317361/index.html",
        creator: "ArcticKona",
        category: "Puzzle",
        tags: ["puzzle", "platformer", "colors"]
      },
      {
        slug: "slime-laboratory",
        title: "Slime Laboratory",
        description: "Help the slime escape the laboratory!",
        thumbnail: "https://img.itch.zone/aW1nLzI0ODgzMjEucG5n/315x250%23c/RhHQcL.png",
        embedUrl: "https://html-classic.itch.zone/html/1244661/index.html",
        creator: "NotDoppler",
        category: "Platformer",
        tags: ["platformer", "action", "escape"]
      },
      {
        slug: "tic-tac-toe-ai",
        title: "Tic Tac Toe",
        description: "Classic tic-tac-toe with AI opponent",
        thumbnail: "https://img.itch.zone/aW1nLzk2NjMxMzgucG5n/315x250%23c/QaRBWD.png",
        embedUrl: "https://html-classic.itch.zone/html/5032584/index.html",
        creator: "DevLogic",
        category: "Board Game",
        tags: ["board-game", "classic", "strategy"]
      },
      {
        slug: "snake-game-html5",
        title: "Snake Game",
        description: "Classic snake game with modern graphics",
        thumbnail: "https://img.itch.zone/aW1nLzc4OTg2MzgucG5n/315x250%23c/0aEF%2Fb.png",
        embedUrl: "https://html-classic.itch.zone/html/4117842/index.html",
        creator: "GameDev",
        category: "Arcade",
        tags: ["arcade", "classic", "snake"]
      },
      {
        slug: "memory-match",
        title: "Memory Match",
        description: "Test your memory with this card matching game",
        thumbnail: "https://img.itch.zone/aW1nLzEwMjM5Njg3LnBuZw==/315x250%23c/rFDpJC.png",
        embedUrl: "https://html-classic.itch.zone/html/5334879/index.html",
        creator: "PuzzleMaster",
        category: "Puzzle",
        tags: ["puzzle", "memory", "cards"]
      },
      {
        slug: "bubble-shooter",
        title: "Bubble Shooter",
        description: "Pop colorful bubbles in this classic game",
        thumbnail: "https://img.itch.zone/aW1nLzY3MTc4MDQucG5n/315x250%23c/Fy%2FmI7.png",
        embedUrl: "https://html-classic.itch.zone/html/3502384/index.html",
        creator: "CasualGames",
        category: "Puzzle",
        tags: ["puzzle", "casual", "bubbles"]
      },
      {
        slug: "flappy-bird-clone",
        title: "Flappy Wings",
        description: "Fly through obstacles in this addictive game",
        thumbnail: "https://img.itch.zone/aW1nLzUwMjQ4OTkucG5n/315x250%23c/KZlZwS.png",
        embedUrl: "https://html-classic.itch.zone/html/2617583/index.html",
        creator: "ArcadeStudio",
        category: "Arcade",
        tags: ["arcade", "endless", "flying"]
      },
      {
        slug: "word-puzzle",
        title: "Word Scramble",
        description: "Unscramble letters to form words",
        thumbnail: "https://img.itch.zone/aW1nLzExNTY4NDU2LnBuZw==/315x250%23c/5vDFyB.png",
        embedUrl: "https://html-classic.itch.zone/html/6027384/index.html",
        creator: "WordGames",
        category: "Educational",
        tags: ["educational", "words", "puzzle"]
      },
      {
        slug: "math-quiz",
        title: "Quick Math",
        description: "Test your math skills with timed quizzes",
        thumbnail: "https://img.itch.zone/aW1nLzg5NTI0NzUucG5n/315x250%23c/Gl%2FKJY.png",
        embedUrl: "https://html-classic.itch.zone/html/4665283/index.html",
        creator: "EduGames",
        category: "Educational",
        tags: ["educational", "math", "quiz"]
      },
      {
        slug: "color-match",
        title: "Color Match",
        description: "Match colors quickly in this reaction game",
        thumbnail: "https://img.itch.zone/aW1nLzc1MjM4NjUucG5n/315x250%23c/KQWBP4.png",
        embedUrl: "https://html-classic.itch.zone/html/3924573/index.html",
        creator: "ReflexGames",
        category: "Casual",
        tags: ["casual", "colors", "reaction"]
      },
      {
        slug: "maze-runner",
        title: "Maze Runner",
        description: "Navigate through challenging mazes",
        thumbnail: "https://img.itch.zone/aW1nLzY4NzQzNDUucG5n/315x250%23c/hKl%2BNQ.png",
        embedUrl: "https://html-classic.itch.zone/html/3584927/index.html",
        creator: "PuzzleWorks",
        category: "Puzzle",
        tags: ["puzzle", "maze", "navigation"]
      },
      {
        slug: "typing-game",
        title: "Type Racer",
        description: "Improve your typing speed with this game",
        thumbnail: "https://img.itch.zone/aW1nLzk0NTgzNzYucG5n/315x250%23c/fRqU8L.png",
        embedUrl: "https://html-classic.itch.zone/html/4928475/index.html",
        creator: "TypeMaster",
        category: "Educational",
        tags: ["educational", "typing", "skills"]
      },
      {
        slug: "jigsaw-puzzle",
        title: "Jigsaw Puzzle",
        description: "Complete beautiful jigsaw puzzles",
        thumbnail: "https://img.itch.zone/aW1nLzExODQyNjM3LnBuZw==/315x250%23c/9LCQXK.png",
        embedUrl: "https://html-classic.itch.zone/html/6175284/index.html",
        creator: "PuzzleLove",
        category: "Puzzle",
        tags: ["puzzle", "jigsaw", "relaxing"]
      },
      {
        slug: "connect-four",
        title: "Connect Four",
        description: "Classic connect four board game",
        thumbnail: "https://img.itch.zone/aW1nLzEwNTczNDg2LnBuZw==/315x250%23c/x7vE9h.png",
        embedUrl: "https://html-classic.itch.zone/html/5512738/index.html",
        creator: "BoardGameFan",
        category: "Board Game",
        tags: ["board-game", "strategy", "classic"]
      }
    ];

    // Get unique categories
    const categories = [...new Set(gamesDatabase.map(g => g.category))].sort();

    // Filter games
    let filteredGames = gamesDatabase;

    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredGames = filteredGames.filter(game =>
        game.title.toLowerCase().includes(lowerQuery) ||
        game.description.toLowerCase().includes(lowerQuery) ||
        game.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        game.creator.toLowerCase().includes(lowerQuery)
      );
    }

    if (category) {
      filteredGames = filteredGames.filter(game =>
        game.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Pagination
    const totalResults = filteredGames.length;
    const totalPages = Math.ceil(totalResults / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedGames = filteredGames.slice(startIndex, startIndex + pageSize);

    return new Response(
      JSON.stringify({
        games: paginatedGames,
        total: totalResults,
        page,
        totalPages,
        categories
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in itchio-search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
