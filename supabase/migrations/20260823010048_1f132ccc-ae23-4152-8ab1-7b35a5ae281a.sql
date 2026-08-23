ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS appointments_user_id_idx ON public.appointments (user_id);

DROP POLICY IF EXISTS "Clients can view their own appointments" ON public.appointments;
CREATE POLICY "Clients can view their own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can cancel their own appointments" ON public.appointments;
CREATE POLICY "Clients can cancel their own appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());