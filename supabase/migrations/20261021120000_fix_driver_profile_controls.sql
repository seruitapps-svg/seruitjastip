-- Repair driver self-service profile access and independent status controls.
-- Existing UI and driver_profiles data model are preserved.

ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_profiles_select_own_account ON public.driver_profiles;
CREATE POLICY driver_profiles_select_own_account
  ON public.driver_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS driver_profiles_insert_own_account ON public.driver_profiles;
CREATE POLICY driver_profiles_insert_own_account
  ON public.driver_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS driver_profiles_update_own_account ON public.driver_profiles;
CREATE POLICY driver_profiles_update_own_account
  ON public.driver_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.driver_toggle_online(_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _updated_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Anda harus login untuk mengubah status driver.';
  END IF;

  UPDATE public.driver_profiles
  SET is_online = COALESCE(_enabled, false)
  WHERE user_id = _user_id;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  IF _updated_count = 0 THEN
    RAISE EXCEPTION 'Profil driver tidak ditemukan untuk akun ini. Lengkapi pendaftaran driver terlebih dahulu.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_toggle_ojek(_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _updated_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Anda harus login untuk mengubah layanan ojek.';
  END IF;

  UPDATE public.driver_profiles
  SET accepts_ojek = COALESCE(_enabled, false)
  WHERE user_id = _user_id;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  IF _updated_count = 0 THEN
    RAISE EXCEPTION 'Profil driver tidak ditemukan untuk akun ini. Lengkapi pendaftaran driver terlebih dahulu.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_toggle_online(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_toggle_ojek(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_toggle_online(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_toggle_ojek(boolean) TO authenticated;
