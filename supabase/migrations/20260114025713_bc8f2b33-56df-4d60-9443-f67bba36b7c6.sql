-- Create playable_games table for Hoyeeh Playables
CREATE TABLE public.playable_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  source TEXT NOT NULL,
  embed_type TEXT NOT NULL CHECK (embed_type IN ('iframe', 'external')),
  tags TEXT[] DEFAULT '{}',
  age_group TEXT,
  languages TEXT[] DEFAULT '{"en"}',
  subject TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'broken', 'unknown')),
  last_health_check TIMESTAMPTZ,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.playable_games ENABLE ROW LEVEL SECURITY;

-- Public read access for verified + active games
CREATE POLICY "Public can view verified active games" 
ON public.playable_games
FOR SELECT 
USING (is_verified = true AND is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage games" 
ON public.playable_games
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger
CREATE TRIGGER update_playable_games_updated_at
BEFORE UPDATE ON public.playable_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial games
INSERT INTO public.playable_games (title, source, subject, embed_type, embed_url, age_group, tags, thumbnail_url, is_verified, display_order) VALUES
('Interland: Tower of Treasure', 'Google', 'Digital Safety', 'external', 'https://beinternetawesome.withgoogle.com/interland', '7-12', ARRAY['safety', 'kids'], 'https://beinternetawesome.withgoogle.com/images/interland/hero-land-treasure.svg', true, 1),
('Cut the Rope: Experiments', 'CrazyGames', 'Logic', 'iframe', 'https://www.crazygames.com/embed/cut-the-rope-ebx', '7+', ARRAY['logic', 'fun'], 'https://images.crazygames.com/games/cut-the-rope-ebx/cover-1678796273627.png', true, 2),
('Zumba Quest', 'CrazyGames', 'Puzzle', 'iframe', 'https://www.crazygames.com/embed/zumba-quest', '8+', ARRAY['match', 'color', 'puzzle'], 'https://images.crazygames.com/zumba-quest/20230828141232/zumba-quest-cover.png', true, 3),
('Castle Craft', 'CrazyGames', 'Strategy', 'iframe', 'https://www.crazygames.com/embed/castle-craft', '10+', ARRAY['strategy', 'castle'], 'https://images.crazygames.com/castle-craft/20240125101606/castle-craft-cover.png', true, 4),
('Ludo Club – Dice Game', 'CrazyGames', 'Family', 'iframe', 'https://www.crazygames.com/embed/ludo-club---fun-dice-game', '7+', ARRAY['dice', 'multiplayer', 'family'], 'https://images.crazygames.com/ludo-club---fun-dice-game/20230922084336/ludo-club---fun-dice-game-cover.png', true, 5),
('Twisted Tangle', 'CrazyGames', 'Logic', 'iframe', 'https://www.crazygames.com/embed/twisted-tangle-nmt', '8+', ARRAY['logic', 'tangle', 'fun'], 'https://images.crazygames.com/twisted-tangle-nmt/20231026074157/twisted-tangle-nmt-cover.png', true, 6);