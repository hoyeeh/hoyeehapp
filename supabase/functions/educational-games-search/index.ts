import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EducationalGame {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  embedUrl: string;
  source: string;
  ageGroup: string;
  subject: string;
  tags: string[];
  embedType: 'iframe' | 'external';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const source = url.searchParams.get('source') || '';
    const subject = url.searchParams.get('subject') || '';
    const ageGroup = url.searchParams.get('ageGroup') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = 20;

    // Curated list of educational games from various sources
    const gamesDatabase: EducationalGame[] = [
      // PBS Kids Games
      {
        slug: "pbs-curious-george-busy-day",
        title: "Curious George: Busy Day",
        description: "Help Curious George complete daily tasks and learn problem-solving",
        thumbnail: "https://pbskids.org/curiousgeorge/busyday/images/thumb.png",
        embedUrl: "https://pbskids.org/curiousgeorge/busyday/",
        source: "PBS Kids",
        ageGroup: "3-6",
        subject: "Problem Solving",
        tags: ["problem-solving", "daily-life", "curious-george"],
        embedType: "external"
      },
      {
        slug: "pbs-wild-kratts-creature-power",
        title: "Wild Kratts: Creature Power",
        description: "Learn about animals and their special abilities",
        thumbnail: "https://pbskids.org/wildkratts/games/creaturepower/images/thumb.png",
        embedUrl: "https://pbskids.org/wildkratts/games/",
        source: "PBS Kids",
        ageGroup: "6-8",
        subject: "Science",
        tags: ["animals", "nature", "science", "biology"],
        embedType: "external"
      },
      {
        slug: "pbs-sesame-street-abc",
        title: "Sesame Street: ABC Games",
        description: "Learn the alphabet with Elmo and friends",
        thumbnail: "https://pbskids.org/sesame/games-images/ss-abc-cookie.png",
        embedUrl: "https://pbskids.org/sesame/games/",
        source: "PBS Kids",
        ageGroup: "2-5",
        subject: "Reading",
        tags: ["alphabet", "letters", "sesame-street", "reading"],
        embedType: "external"
      },
      {
        slug: "pbs-odd-squad-odd-invasion",
        title: "Odd Squad: Odd Invasion",
        description: "Use math skills to solve odd problems",
        thumbnail: "https://pbskids.org/oddsquad/games/odd-invasion/images/thumb.png",
        embedUrl: "https://pbskids.org/oddsquad/games/",
        source: "PBS Kids",
        ageGroup: "5-8",
        subject: "Math",
        tags: ["math", "problem-solving", "odd-squad"],
        embedType: "external"
      },
      
      // ABCya Games
      {
        slug: "abcya-letter-trace",
        title: "Letter Trace",
        description: "Practice writing uppercase and lowercase letters",
        thumbnail: "https://www.abcya.com/games/letter_trace/icon.png",
        embedUrl: "https://www.abcya.com/games/letter_trace",
        source: "ABCya",
        ageGroup: "3-5",
        subject: "Writing",
        tags: ["writing", "letters", "handwriting"],
        embedType: "external"
      },
      {
        slug: "abcya-counting-fish",
        title: "Counting Fish",
        description: "Learn to count with colorful fish",
        thumbnail: "https://www.abcya.com/games/counting_fish/icon.png",
        embedUrl: "https://www.abcya.com/games/counting_fish",
        source: "ABCya",
        ageGroup: "3-5",
        subject: "Math",
        tags: ["counting", "numbers", "fish"],
        embedType: "external"
      },
      {
        slug: "abcya-typing-rocket",
        title: "Typing Rocket Jr",
        description: "Learn keyboard typing with rockets",
        thumbnail: "https://www.abcya.com/games/typing_rocket_jr/icon.png",
        embedUrl: "https://www.abcya.com/games/typing_rocket_jr",
        source: "ABCya",
        ageGroup: "5-7",
        subject: "Typing",
        tags: ["typing", "keyboard", "letters"],
        embedType: "external"
      },
      {
        slug: "abcya-make-a-pizza",
        title: "Make a Pizza",
        description: "Learn fractions while making delicious pizzas",
        thumbnail: "https://www.abcya.com/games/make_a_pizza/icon.png",
        embedUrl: "https://www.abcya.com/games/make_a_pizza",
        source: "ABCya",
        ageGroup: "6-9",
        subject: "Math",
        tags: ["fractions", "cooking", "math"],
        embedType: "external"
      },
      
      // Coolmath Games
      {
        slug: "coolmath-duck-life",
        title: "Duck Life",
        description: "Train your duck to become a racing champion",
        thumbnail: "https://www.coolmathgames.com/sites/default/files/Duck%20Life.png",
        embedUrl: "https://www.coolmathgames.com/0-duck-life",
        source: "Coolmath Games",
        ageGroup: "6-12",
        subject: "Strategy",
        tags: ["strategy", "simulation", "training"],
        embedType: "external"
      },
      {
        slug: "coolmath-run-3",
        title: "Run 3",
        description: "Navigate through space tunnels with skill",
        thumbnail: "https://www.coolmathgames.com/sites/default/files/Run%203.png",
        embedUrl: "https://www.coolmathgames.com/0-run-3",
        source: "Coolmath Games",
        ageGroup: "8-14",
        subject: "Logic",
        tags: ["running", "spatial-awareness", "reflexes"],
        embedType: "external"
      },
      {
        slug: "coolmath-fireboy-watergirl",
        title: "Fireboy and Watergirl",
        description: "Solve puzzles with two elemental characters",
        thumbnail: "https://www.coolmathgames.com/sites/default/files/Fireboy%20and%20Watergirl.png",
        embedUrl: "https://www.coolmathgames.com/0-fireboy-and-watergirl-forest-temple",
        source: "Coolmath Games",
        ageGroup: "6-12",
        subject: "Problem Solving",
        tags: ["puzzle", "cooperation", "elements"],
        embedType: "external"
      },
      {
        slug: "coolmath-2048",
        title: "2048",
        description: "Combine numbers to reach 2048",
        thumbnail: "https://www.coolmathgames.com/sites/default/files/2048_0.png",
        embedUrl: "https://www.coolmathgames.com/0-2048",
        source: "Coolmath Games",
        ageGroup: "8-14",
        subject: "Math",
        tags: ["math", "numbers", "strategy"],
        embedType: "external"
      },
      
      // Code.org / Scratch
      {
        slug: "scratch-getting-started",
        title: "Scratch: Getting Started",
        description: "Learn coding basics with Scratch",
        thumbnail: "https://scratch.mit.edu/images/scratch-og.png",
        embedUrl: "https://scratch.mit.edu/projects/editor/",
        source: "Scratch",
        ageGroup: "8-16",
        subject: "Coding",
        tags: ["coding", "programming", "creative"],
        embedType: "external"
      },
      {
        slug: "code-org-hour-of-code",
        title: "Hour of Code",
        description: "Learn coding with fun tutorials",
        thumbnail: "https://code.org/shared/images/social-media/code-2019-social.png",
        embedUrl: "https://studio.code.org/courses",
        source: "Code.org",
        ageGroup: "6-18",
        subject: "Coding",
        tags: ["coding", "programming", "tutorials"],
        embedType: "external"
      },
      {
        slug: "code-org-minecraft",
        title: "Minecraft Hour of Code",
        description: "Learn coding with Minecraft characters",
        thumbnail: "https://code.org/images/mc/mc_social.jpg",
        embedUrl: "https://studio.code.org/s/mc",
        source: "Code.org",
        ageGroup: "6-14",
        subject: "Coding",
        tags: ["coding", "minecraft", "adventure"],
        embedType: "external"
      },
      
      // Google Interland
      {
        slug: "google-interland",
        title: "Be Internet Awesome: Interland",
        description: "Learn about internet safety in a fun game",
        thumbnail: "https://beinternetawesome.withgoogle.com/static/interland/img/og-image.jpg",
        embedUrl: "https://beinternetawesome.withgoogle.com/interland",
        source: "Google",
        ageGroup: "7-12",
        subject: "Digital Safety",
        tags: ["internet-safety", "digital-citizenship", "online"],
        embedType: "external"
      },
      
      // National Geographic Kids
      {
        slug: "natgeo-quiz-whiz",
        title: "Quiz Whiz",
        description: "Test your knowledge about animals and nature",
        thumbnail: "https://kids.nationalgeographic.com/content/dam/kids/icons/quiz-whiz.png",
        embedUrl: "https://kids.nationalgeographic.com/games/quizzes",
        source: "National Geographic Kids",
        ageGroup: "6-12",
        subject: "Science",
        tags: ["animals", "nature", "quiz", "science"],
        embedType: "external"
      },
      {
        slug: "natgeo-animal-jam",
        title: "Animal Jam",
        description: "Explore nature and learn about animals",
        thumbnail: "https://kids.nationalgeographic.com/content/dam/kids/icons/animal-jam.png",
        embedUrl: "https://kids.nationalgeographic.com/games/",
        source: "National Geographic Kids",
        ageGroup: "6-11",
        subject: "Science",
        tags: ["animals", "nature", "exploration"],
        embedType: "external"
      },
      
      // Math Playground
      {
        slug: "mathplayground-number-bonds",
        title: "Number Bonds",
        description: "Practice number combinations",
        thumbnail: "https://www.mathplayground.com/images/number_bonds_10.gif",
        embedUrl: "https://www.mathplayground.com/number_bonds_10.html",
        source: "Math Playground",
        ageGroup: "5-8",
        subject: "Math",
        tags: ["math", "numbers", "addition"],
        embedType: "iframe"
      },
      {
        slug: "mathplayground-fraction-forest",
        title: "Fraction Forest",
        description: "Learn fractions through adventure",
        thumbnail: "https://www.mathplayground.com/images/fraction_forest.png",
        embedUrl: "https://www.mathplayground.com/ASB_FractionForest.html",
        source: "Math Playground",
        ageGroup: "7-11",
        subject: "Math",
        tags: ["fractions", "math", "adventure"],
        embedType: "iframe"
      },
      {
        slug: "mathplayground-logic-games",
        title: "Logic Games",
        description: "Solve challenging logic puzzles",
        thumbnail: "https://www.mathplayground.com/images/logic_games.png",
        embedUrl: "https://www.mathplayground.com/logic_games.html",
        source: "Math Playground",
        ageGroup: "8-14",
        subject: "Logic",
        tags: ["logic", "puzzles", "thinking"],
        embedType: "external"
      },
      
      // Arcademics
      {
        slug: "arcademics-grand-prix",
        title: "Grand Prix Multiplication",
        description: "Race while practicing multiplication",
        thumbnail: "https://www.arcademics.com/images/games/grand-prix.png",
        embedUrl: "https://www.arcademics.com/games/grand-prix",
        source: "Arcademics",
        ageGroup: "7-12",
        subject: "Math",
        tags: ["multiplication", "racing", "math"],
        embedType: "external"
      },
      {
        slug: "arcademics-spelling-bees",
        title: "Spelling Bees",
        description: "Race and spell words correctly",
        thumbnail: "https://www.arcademics.com/images/games/spelling-bees.png",
        embedUrl: "https://www.arcademics.com/games/spelling-bees",
        source: "Arcademics",
        ageGroup: "6-10",
        subject: "Spelling",
        tags: ["spelling", "words", "racing"],
        embedType: "external"
      },
      
      // Typing.com
      {
        slug: "typing-com-jungle-junior",
        title: "Jungle Junior",
        description: "Learn typing in a jungle adventure",
        thumbnail: "https://www.typing.com/images/games/jungle-junior-icon.png",
        embedUrl: "https://www.typing.com/student/games",
        source: "Typing.com",
        ageGroup: "6-10",
        subject: "Typing",
        tags: ["typing", "keyboard", "adventure"],
        embedType: "external"
      }
    ];

    // Get unique values for filters
    const sources = [...new Set(gamesDatabase.map(g => g.source))].sort();
    const subjects = [...new Set(gamesDatabase.map(g => g.subject))].sort();
    const ageGroups = [...new Set(gamesDatabase.map(g => g.ageGroup))].sort();

    // Filter games
    let filteredGames = gamesDatabase;

    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredGames = filteredGames.filter(game =>
        game.title.toLowerCase().includes(lowerQuery) ||
        game.description.toLowerCase().includes(lowerQuery) ||
        game.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        game.source.toLowerCase().includes(lowerQuery) ||
        game.subject.toLowerCase().includes(lowerQuery)
      );
    }

    if (source) {
      filteredGames = filteredGames.filter(game =>
        game.source.toLowerCase() === source.toLowerCase()
      );
    }

    if (subject) {
      filteredGames = filteredGames.filter(game =>
        game.subject.toLowerCase() === subject.toLowerCase()
      );
    }

    if (ageGroup) {
      filteredGames = filteredGames.filter(game =>
        game.ageGroup === ageGroup
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
        sources,
        subjects,
        ageGroups
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in educational-games-search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
