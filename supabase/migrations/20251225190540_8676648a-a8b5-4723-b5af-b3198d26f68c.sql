-- Create helper function to check if user is a member of a party (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_party_member(_user_id uuid, _party_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.watch_party_members
    WHERE user_id = _user_id
      AND party_id = _party_id
  )
$$;

-- Create helper function to check if user is host of a party (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_party_host(_user_id uuid, _party_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.watch_parties
    WHERE id = _party_id
      AND host_user_id = _user_id
  )
$$;

-- Drop the existing recursive policy on watch_parties
DROP POLICY IF EXISTS "Users can view active parties they're in" ON public.watch_parties;

-- Drop the existing recursive policy on watch_party_members
DROP POLICY IF EXISTS "Members can view party members" ON public.watch_party_members;

-- Create new non-recursive SELECT policy for watch_parties
CREATE POLICY "Users can view active parties they're in"
ON public.watch_parties
FOR SELECT
USING (
  is_active = true 
  AND (
    host_user_id = auth.uid() 
    OR public.is_party_member(auth.uid(), id)
  )
);

-- Create new non-recursive SELECT policy for watch_party_members
CREATE POLICY "Members can view party members"
ON public.watch_party_members
FOR SELECT
USING (
  public.is_party_host(auth.uid(), party_id)
  OR public.is_party_member(auth.uid(), party_id)
);