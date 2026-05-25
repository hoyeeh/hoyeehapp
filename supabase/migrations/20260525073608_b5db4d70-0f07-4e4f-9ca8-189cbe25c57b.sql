ALTER TABLE public.cast_sessions
  ADD COLUMN IF NOT EXISTS last_acked_seq bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ack_status text,
  ADD COLUMN IF NOT EXISTS last_ack_error text,
  ADD COLUMN IF NOT EXISTS last_ack_at timestamptz;