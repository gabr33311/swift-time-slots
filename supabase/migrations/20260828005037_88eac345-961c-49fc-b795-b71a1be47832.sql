CREATE OR REPLACE FUNCTION public.enforce_public_booking_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'public' THEN
    NEW.status := 'pending'::public.appointment_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_public_booking_pending ON public.appointments;
CREATE TRIGGER enforce_public_booking_pending
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_public_booking_pending();