-- Create walkthrough_screens table for admin-managed onboarding screens
CREATE TABLE public.walkthrough_screens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.walkthrough_screens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active walkthrough screens" 
ON public.walkthrough_screens 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all walkthrough screens" 
ON public.walkthrough_screens 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert walkthrough screens" 
ON public.walkthrough_screens 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update walkthrough screens" 
ON public.walkthrough_screens 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete walkthrough screens" 
ON public.walkthrough_screens 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_walkthrough_screens_updated_at
BEFORE UPDATE ON public.walkthrough_screens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default walkthrough screens with the uploaded images
INSERT INTO public.walkthrough_screens (title, description, image_url, display_order) VALUES
('Welcome to Hoyeeh', 'Stream unlimited movies and TV shows with your family', '/walkthrough/walkthrough01.webp', 1),
('Discover Amazing Content', 'Explore thousands of titles across all genres', '/walkthrough/walkthrough02.webp', 2);