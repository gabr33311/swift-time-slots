-- 1. Audit log forgery: remove free-form member inserts, add trusted writer
DROP POLICY IF EXISTS "members insert audit" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _business_id uuid,
  _action text,
  _entity text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _business_id IS NULL OR NOT public.is_business_member(_business_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.audit_logs (business_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_business_id, auth.uid(), left(_action, 120), left(_entity, 120), _entity_id, _metadata)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) TO authenticated;

-- 2. blocked_times: stop exposing internal reason text publicly
DROP POLICY IF EXISTS "public read blocked times" ON public.blocked_times;
REVOKE SELECT ON public.blocked_times FROM anon;
