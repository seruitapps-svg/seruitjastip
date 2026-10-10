
CREATE TYPE public.app_role AS ENUM ('superadmin','driver','user');
CREATE TYPE public.order_status AS ENUM ('menunggu_verifikasi','ditolak','tersedia','diambil','dijemput','diantar','selesai','dibatalkan');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

-- Signup: profil + peran user; akun pertama jadi superadmin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  user_id uuid NOT NULL,
  driver_id uuid,
  service text NOT NULL CHECK (service IN ('titip','kirim','belanja')),
  status public.order_status NOT NULL DEFAULT 'menunggu_verifikasi',
  origin_address text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  dest_address text NOT NULL,
  dest_lat double precision NOT NULL,
  dest_lng double precision NOT NULL,
  distance_meters integer NOT NULL,
  duration_seconds integer NOT NULL,
  encoded_polyline text NOT NULL DEFAULT '',
  item_detail text NOT NULL,
  weight_kg numeric NOT NULL,
  length_cm numeric NOT NULL,
  width_cm numeric NOT NULL,
  height_cm numeric NOT NULL,
  sender_name text NOT NULL,
  sender_wa text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  recipient_wa text NOT NULL DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('cod','transfer')),
  notes text NOT NULL DEFAULT '',
  base_fare integer NOT NULL,
  distance_fare integer NOT NULL,
  oversize_fee integer NOT NULL DEFAULT 0,
  total integer NOT NULL,
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_user_idx ON public.orders(user_id);
CREATE INDEX orders_driver_idx ON public.orders(driver_id);

CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR driver_id = auth.uid()
  OR public.has_role(auth.uid(),'superadmin')
  OR (status = 'tersedia' AND public.has_role(auth.uid(),'driver'))
);
CREATE POLICY "orders insert own" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status = 'menunggu_verifikasi' AND driver_id IS NULL
);

CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_order(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND (
    o.user_id = auth.uid() OR o.driver_id = auth.uid() OR public.has_role(auth.uid(),'superadmin')))
$$;

CREATE POLICY "history read" ON public.order_status_history FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));

CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, status, changed_by, note)
    VALUES (NEW.id, NEW.status, auth.uid(), CASE WHEN TG_OP='UPDATE' THEN NEW.admin_note ELSE '' END);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER orders_status_log_ins AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_status();
CREATE TRIGGER orders_status_log_upd BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  sender_role text NOT NULL DEFAULT 'user',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX order_messages_order_idx ON public.order_messages(order_id, created_at);
CREATE POLICY "messages read" ON public.order_messages FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));
CREATE POLICY "messages insert" ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_order(order_id));

-- isi nama & peran pengirim otomatis
CREATE OR REPLACE FUNCTION public.fill_message_sender()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  NEW.sender_role := CASE
    WHEN public.has_role(NEW.sender_id,'superadmin') AND o.user_id <> NEW.sender_id AND COALESCE(o.driver_id,'00000000-0000-0000-0000-000000000000') <> NEW.sender_id THEN 'admin'
    WHEN o.driver_id = NEW.sender_id THEN 'driver'
    WHEN o.user_id = NEW.sender_id THEN 'user'
    ELSE 'admin' END;
  SELECT COALESCE(NULLIF(full_name,''), email, 'Pengguna') INTO NEW.sender_name FROM public.profiles WHERE id = NEW.sender_id;
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER order_messages_fill BEFORE INSERT ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.fill_message_sender();

-- Aksi status (atomik, cek peran)
CREATE OR REPLACE FUNCTION public.admin_review_order(_order_id uuid, _approve boolean, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  UPDATE public.orders SET status = CASE WHEN _approve THEN 'tersedia'::order_status ELSE 'ditolak'::order_status END,
    admin_note = COALESCE(_note,'')
  WHERE id = _order_id AND status = 'menunggu_verifikasi';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak menunggu verifikasi'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.driver_take_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Hanya driver'; END IF;
  UPDATE public.orders SET status = 'diambil', driver_id = auth.uid()
  WHERE id = _order_id AND status = 'tersedia' AND driver_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order sudah diambil driver lain'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.driver_advance_order(_order_id uuid)
RETURNS public.order_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur public.order_status; nxt public.order_status;
BEGIN
  SELECT status INTO cur FROM public.orders WHERE id = _order_id AND driver_id = auth.uid() FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Bukan order Anda'; END IF;
  nxt := CASE cur WHEN 'diambil' THEN 'dijemput'::order_status WHEN 'dijemput' THEN 'diantar'::order_status WHEN 'diantar' THEN 'selesai'::order_status END;
  IF nxt IS NULL THEN RAISE EXCEPTION 'Status tidak bisa dilanjutkan'; END IF;
  UPDATE public.orders SET status = nxt WHERE id = _order_id;
  RETURN nxt;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'superadmin') THEN
    UPDATE public.orders SET status='dibatalkan', admin_note=COALESCE(_note,'')
    WHERE id=_order_id AND status NOT IN ('selesai','dibatalkan','ditolak');
  ELSE
    UPDATE public.orders SET status='dibatalkan'
    WHERE id=_order_id AND user_id=auth.uid() AND status IN ('menunggu_verifikasi','tersedia');
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak bisa dibatalkan'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id,_role) ON CONFLICT DO NOTHING;
  ELSE
    IF _user_id = auth.uid() AND _role = 'superadmin' THEN RAISE EXCEPTION 'Tidak bisa mencabut admin diri sendiri'; END IF;
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_review_order, public.driver_take_order, public.driver_advance_order, public.cancel_order, public.admin_set_role FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_review_order, public.driver_take_order, public.driver_advance_order, public.cancel_order, public.admin_set_role TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
