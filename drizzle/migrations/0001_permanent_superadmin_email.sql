
CREATE OR REPLACE FUNCTION public.is_permanent_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'seruitapps@gmail.com')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF lower(NEW.email) = 'seruitapps@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin'), (NEW.id, 'driver') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id,_role) ON CONFLICT DO NOTHING;
  ELSE
    IF public.is_permanent_admin(_user_id) THEN RAISE EXCEPTION 'Peran akun admin utama tidak bisa dicabut'; END IF;
    IF _user_id = auth.uid() AND _role = 'superadmin' THEN RAISE EXCEPTION 'Tidak bisa mencabut admin diri sendiri'; END IF;
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role;
  END IF;
END $$;

-- Jika akun sudah terdaftar sebelumnya
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role FROM auth.users u
CROSS JOIN (VALUES ('superadmin'::public.app_role), ('driver'::public.app_role), ('user'::public.app_role)) AS r(role)
WHERE lower(u.email) = 'seruitapps@gmail.com'
ON CONFLICT DO NOTHING;
