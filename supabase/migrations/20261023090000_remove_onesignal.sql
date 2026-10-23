-- Remove OneSignal-only RPCs and its Vault secret.
-- FCM token registration (register_user_push_token) is intentionally preserved.
DROP FUNCTION IF EXISTS public.admin_onesignal_secret_status();
DROP FUNCTION IF EXISTS public.admin_save_onesignal_secret(text);
DROP FUNCTION IF EXISTS public.get_onesignal_rest_api_key();

DO $$
BEGIN
  IF to_regclass('vault.secrets') IS NOT NULL THEN
    EXECUTE $delete$
      DELETE FROM vault.secrets
      WHERE name IN ('onesignal_rest_api_key', 'ONESIGNAL_REST_API_KEY')
    $delete$;
  END IF;
END
$$;
