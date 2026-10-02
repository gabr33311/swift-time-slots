CREATE OR REPLACE FUNCTION public.public_busy_intervals(_business_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (kind text, staff_id uuid, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'appointment'::text, a.staff_id, a.starts_at, a.ends_at
  FROM public.appointments a
  JOIN public.businesses b ON b.id = a.business_id AND b.is_published AND b.deleted_at IS NULL
  WHERE a.business_id = _business_id AND a.status IN ('pending','confirmed')
    AND a.starts_at < _to AND a.ends_at > _from
  UNION ALL
  SELECT 'block'::text, t.staff_id, t.starts_at, t.ends_at
  FROM public.blocked_times t
  JOIN public.businesses b ON b.id = t.business_id AND b.is_published AND b.deleted_at IS NULL
  WHERE t.business_id = _business_id AND t.starts_at < _to AND t.ends_at > _from
    AND _to - _from <= interval '400 days'
$$;
REVOKE ALL ON FUNCTION public.public_busy_intervals(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_busy_intervals(uuid, timestamptz, timestamptz) TO anon, authenticated, service_role;