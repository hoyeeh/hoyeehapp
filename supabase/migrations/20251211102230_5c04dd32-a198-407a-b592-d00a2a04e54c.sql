-- Add assigned_to column for ticket assignment
ALTER TABLE public.support_tickets 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Create table for admin ticket type preferences
CREATE TABLE public.admin_ticket_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  ticket_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(admin_id, ticket_type)
);

-- Enable RLS
ALTER TABLE public.admin_ticket_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage assignments
CREATE POLICY "Admins can view ticket assignments"
ON public.admin_ticket_assignments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert ticket assignments"
ON public.admin_ticket_assignments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ticket assignments"
ON public.admin_ticket_assignments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ticket assignments"
ON public.admin_ticket_assignments
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create function to auto-assign tickets
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_admin uuid;
BEGIN
  -- Find an active admin for this ticket type
  SELECT admin_id INTO assigned_admin
  FROM public.admin_ticket_assignments
  WHERE ticket_type = NEW.ticket_type
    AND is_active = true
  ORDER BY random()
  LIMIT 1;
  
  -- If no specific assignment, try to find any active admin
  IF assigned_admin IS NULL THEN
    SELECT admin_id INTO assigned_admin
    FROM public.admin_ticket_assignments
    WHERE ticket_type = 'general'
      AND is_active = true
    ORDER BY random()
    LIMIT 1;
  END IF;
  
  NEW.assigned_to := assigned_admin;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign on insert
CREATE TRIGGER auto_assign_support_ticket
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_ticket();