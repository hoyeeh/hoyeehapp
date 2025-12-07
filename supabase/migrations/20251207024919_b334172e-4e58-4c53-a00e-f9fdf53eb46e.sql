-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  country TEXT DEFAULT 'US',
  is_subscribed BOOLEAN DEFAULT false,
  subscription_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content table for movies/shows
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  genre TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  is_premium BOOLEAN DEFAULT false,
  duration INTEGER DEFAULT 0,
  year INTEGER,
  rating TEXT,
  tmdb_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create watchlist table (My List)
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Create watch history table
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  last_watched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Content policies (public read, admin write)
CREATE POLICY "Anyone can view content"
  ON public.content FOR SELECT
  USING (true);

-- Watchlist policies
CREATE POLICY "Users can view their own watchlist"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Watch history policies
CREATE POLICY "Users can view their own watch history"
  ON public.watch_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watch history"
  ON public.watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch history"
  ON public.watch_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample content
INSERT INTO public.content (title, description, thumbnail_url, video_url, genre, content_type, is_premium, duration, year, rating) VALUES
('Lion King: Return', 'A young lion prince must reclaim his homeland after the murder of his father.', 'https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg', '/videos/lionking.mp4', 'Drama', 'movie', false, 7200, 2024, 'PG'),
('Wakanda Forever', 'The nation of Wakanda fights to protect their home from intervening world powers.', 'https://image.tmdb.org/t/p/w500/sv1xJUazXeYqALzczSZ3O6nkH75.jpg', '/videos/wakanda.mp4', 'Action', 'movie', true, 9000, 2023, 'PG-13'),
('Queen of Katwe', 'A Ugandan girls life changes forever when she discovers chess.', 'https://image.tmdb.org/t/p/w500/tYqFVDBEZq9bMIbG8Nm3D2zAZMS.jpg', '/videos/katwe.mp4', 'Biography', 'movie', false, 6900, 2022, 'PG'),
('Blood Diamond', 'A fisherman, a smuggler, and a syndicate of businessmen match wits over a diamond.', 'https://image.tmdb.org/t/p/w500/dvMQOFVNOd7Rh9rQPKMbpj5FQtC.jpg', '/videos/blooddiamond.mp4', 'Thriller', 'movie', true, 8400, 2021, 'R'),
('African Queens', 'The untold stories of Africas most powerful queens throughout history.', 'https://image.tmdb.org/t/p/w500/AjV6jFJ2YFIluYo4GRT9issEXpG.jpg', '/videos/queens.mp4', 'Documentary', 'series', false, 3600, 2024, 'TV-14'),
('Lagos Chronicles', 'Five friends navigate love, business, and dreams in the heart of Lagos.', 'https://image.tmdb.org/t/p/w500/6POBWybSBDBKjSs1VAQcnQC1qyt.jpg', '/videos/lagos.mp4', 'Drama', 'series', true, 2700, 2024, 'TV-MA'),
('Safari Adventures', 'Wildlife documentary exploring the Serengeti and its magnificent creatures.', 'https://image.tmdb.org/t/p/w500/rMvPXy8PUjj1o8o1pzgQbwUhOYZ.jpg', '/videos/safari.mp4', 'Documentary', 'series', false, 2400, 2023, 'G'),
('Nairobi Heat', 'A detective duo solves crimes in the bustling streets of Nairobi.', 'https://image.tmdb.org/t/p/w500/dqK9Hag1054tghRQSqLSfrkvQnA.jpg', '/videos/nairobi.mp4', 'Crime', 'series', true, 3000, 2024, 'TV-14');