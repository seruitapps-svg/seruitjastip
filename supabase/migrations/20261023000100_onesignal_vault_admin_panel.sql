-- Mider: OneSignal secret Vault bridge
-- Jalankan satu kali melalui SQL Editor Lovable.
-- Tidak membuat tabel publik dan tidak mengembalikan nilai secret ke browser.

CREATE OR REPLACE FUNCTION public.admin_save_onesignal_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF p_secret IS NULL OR length(btrim(p_secret)) < 20 THEN
    RAISE EXCEPTION 'API Key tidak valid';
  END IF;

  SELECT ds.id
    INTO v_secret_id
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'ONESIGNAL_REST_API_KEY'
  LIMIT 1;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      p_secret,
      'ONESIGNAL_REST_API_KEY',
      'Mider OneSignal REST API key',
      NULL
    );
  ELSE
    PERFORM vault.update_secret(
      v_secret_id,
      p_secret,
      'ONESIGNAL_REST_API_KEY',
      'Mider OneSignal REST API key',
      NULL
    );
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_onesignal_secret_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'ONESIGNAL_REST_API_KEY'
      AND ds.decrypted_secret IS NOT NULL
      AND length(ds.decrypted_secret) > 0
  );
END;
$$;

-- Fungsi baca khusus server. Browser/anon/authenticated tidak boleh menjalankannya.
CREATE OR REPLACE FUNCTION public.get_onesignal_rest_api_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ds.decrypted_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'ONESIGNAL_REST_API_KEY'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.admin_save_onesignal_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_onesignal_secret(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_onesignal_secret_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_onesignal_secret_status() TO authenticated;

REVOKE ALL ON FUNCTION public.get_onesignal_rest_api_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_onesignal_rest_api_key() TO service_role;
