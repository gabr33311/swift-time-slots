-- Security Advisor (19/10/2026).

-- 1) An old policy, made in the dashboard, let any signed-in user create a business
--    in someone else's name. The right one stays: "authenticated create business"
--    (created_by = auth.uid()).
drop policy if exists "Permitir criacao de negocios" on public.businesses;

-- 2) The audit log is for signed-in members only (the function already refuses
--    visitors; now they cannot even call it).
revoke execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) from anon, public;
grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;
