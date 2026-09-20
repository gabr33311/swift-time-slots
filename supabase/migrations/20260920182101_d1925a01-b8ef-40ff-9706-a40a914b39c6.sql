-- 1. Clients may no longer edit their appointment rows directly (cancellation happens server-side)
DROP POLICY IF EXISTS "Clients can cancel their own appointments" ON public.appointments;

-- 2. Public staff listing honours the business "show team" setting
DROP POLICY IF EXISTS "public read active staff" ON public.staff;
CREATE POLICY "public read active staff" ON public.staff
FOR SELECT TO anon, authenticated
USING (
  is_active AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = staff.business_id
      AND b.is_published
      AND b.deleted_at IS NULL
      AND b.show_team
  )
);

-- 3. Business contact details are no longer world-readable through the API.
--    The public booking page is rendered server-side with elevated credentials.
DROP POLICY IF EXISTS "public can read published businesses" ON public.businesses;

-- 4. SECURITY DEFINER helpers are no longer callable by anonymous or signed-in users
REVOKE EXECUTE ON FUNCTION public.email_has_account(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.slug_available(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_appointment_reminders() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_has_account(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.slug_available(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_appointment_reminders() TO service_role;