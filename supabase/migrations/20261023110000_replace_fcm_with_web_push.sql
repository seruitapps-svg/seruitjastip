-- Replace FCM device tokens with standard Web Push subscriptions.
-- The subscription table is server-managed; clients register through the
-- authenticated SECURITY DEFINER RPCs below. Existing notification history is untouched.

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  platform text NOT NULL DEFAULT 'web_pwa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.register_user_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_platform text DEFAULT 'web_pwa'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_endpoint IS NULL OR p_endpoint NOT LIKE 'https://%'
     OR length(p_endpoint) > 4096
     OR p_p256dh IS NULL OR length(p_p256dh) < 16
     OR p_auth_key IS NULL OR length(p_auth_key) < 8 THEN
    RAISE EXCEPTION 'Invalid Web Push subscription';
  END IF;

  INSERT INTO public.user_push_subscriptions
    (user_id, endpoint, p256dh, auth_key, platform, created_at, updated_at)
  VALUES
    (v_user_id, p_endpoint, p_p256dh, p_auth_key,
     COALESCE(NULLIF(p_platform, ''), 'web_pwa'), now(), now())
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth_key = EXCLUDED.auth_key,
        platform = EXCLUDED.platform,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_user_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.user_push_subscriptions
  WHERE endpoint = p_endpoint
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_push_subscription(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unregister_user_push_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_user_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_user_push_subscription(text) TO authenticated;

-- Remove FCM-only registration RPC overloads and the old FCM token table.
-- No CASCADE is used: if another database object depends on these objects,
-- the migration stops instead of silently deleting that dependency.
DO $$
DECLARE
  legacy_function record;
BEGIN
  FOR legacy_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'register_user_push_token'
  LOOP
    EXECUTE format('DROP FUNCTION %s', legacy_function.signature);
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public.user_push_tokens;
