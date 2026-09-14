ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS booking_horizon_months integer NOT NULL DEFAULT 2;