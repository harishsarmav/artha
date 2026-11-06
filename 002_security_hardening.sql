-- Artha security hardening: ai_usage RLS + atomic per-user daily AI quota.
-- Apply only after confirming migration 001 has created public.ai_usage.

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users may inspect only their own quota row. All writes go through the
-- SECURITY DEFINER RPC below, which validates auth.uid() and enforces the fixed limit.
DROP POLICY IF EXISTS ai_usage_select_own ON public.ai_usage;
DROP POLICY IF EXISTS ai_usage_insert_own ON public.ai_usage;
DROP POLICY IF EXISTS ai_usage_update_own ON public.ai_usage;
DROP POLICY IF EXISTS ai_usage_delete_own ON public.ai_usage;
DROP POLICY IF EXISTS ai_usage_owner ON public.ai_usage;

CREATE POLICY ai_usage_select_own ON public.ai_usage
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.ai_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_usage TO authenticated;

-- Remove the earlier insecure overload if the preliminary remediation was applied.
DROP FUNCTION IF EXISTS public.consume_ai_quota(uuid, date, integer);

-- Atomic quota increment. The function validates the caller identity even though
-- it runs as SECURITY DEFINER. It returns NULL only by raising the limit exception.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to consume quota for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_usage (user_id, usage_date, request_count)
  VALUES (p_user_id, (now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    request_count = public.ai_usage.request_count + 1,
    updated_at = now()
  WHERE public.ai_usage.request_count < 30
  RETURNING request_count INTO v_count;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'AI_DAILY_LIMIT_REACHED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid) TO authenticated;
