ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ojek_base_fare integer NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS ojek_per_km integer NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS jastip_min_price integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS jastip_max_price integer NOT NULL DEFAULT 150000;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS passenger_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.snapshot_order_fees()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE s public.app_settings; BEGIN
SELECT * INTO STRICT s FROM public.app_settings WHERE id=1;
IF NEW.payment_method NOT IN ('cod','transfer') OR NEW.distance_meters<0 THEN RAISE EXCEPTION 'Data pembayaran atau jarak tidak valid'; END IF;
IF NEW.service NOT IN ('titip','kirim','belanja','ojek') THEN RAISE EXCEPTION 'Layanan tidak valid'; END IF;
IF NEW.service='ojek' THEN
  NEW.base_fare:=s.ojek_base_fare; NEW.distance_fare:=greatest(1,ceil(NEW.distance_meters/1000.0))::integer*s.ojek_per_km;
  NEW.oversize_fee:=0; NEW.passenger_count:=1;
ELSE
  NEW.base_fare:=s.base_fare; NEW.distance_fare:=greatest(1,ceil(NEW.distance_meters/1000.0))::integer*s.per_km;
  NEW.oversize_fee:=CASE WHEN NEW.weight_kg>5 OR NEW.length_cm>100 OR NEW.width_cm>100 OR NEW.height_cm>100 THEN s.oversize_fee ELSE 0 END;
  NEW.passenger_count:=0;
END IF;
NEW.consumer_service_fee:=NEW.base_fare; NEW.shipping_fare:=NEW.distance_fare+NEW.oversize_fee; NEW.total:=NEW.shipping_fare+NEW.consumer_service_fee; NEW.commission_percent:=s.commission_percent;
NEW.driver_commission:=ceil(NEW.shipping_fare*s.commission_percent/100.0)::integer; NEW.driver_net_earnings:=NEW.shipping_fare-NEW.driver_commission; NEW.app_fee:=NEW.consumer_service_fee+NEW.driver_commission;
NEW.deposit_deduction:=CASE WHEN NEW.payment_method='cod' THEN NEW.app_fee ELSE 0 END; NEW.monetization_version:=1; NEW.fee_charged:=false; NEW.earnings_credited:=false;
-- Mode On-Bid: langsung masuk pool driver
NEW.status:='tersedia'; NEW.driver_id:=NULL;
RETURN NEW; END $function$;

DROP POLICY IF EXISTS "orders insert own" ON public.orders;
CREATE POLICY "orders insert own" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'tersedia'::order_status AND driver_id IS NULL);

CREATE OR REPLACE FUNCTION public.admin_update_mode_settings(_ojek_base_fare integer, _ojek_per_km integer, _jastip_min_price integer, _jastip_max_price integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya Superadmin'; END IF;
  IF _ojek_base_fare<0 OR _ojek_per_km<0 OR _jastip_min_price<0 OR _jastip_max_price<_jastip_min_price THEN
    RAISE EXCEPTION 'Nilai tidak valid (harga maksimal harus ≥ minimal)'; END IF;
  UPDATE public.app_settings SET ojek_base_fare=_ojek_base_fare, ojek_per_km=_ojek_per_km,
    jastip_min_price=_jastip_min_price, jastip_max_price=_jastip_max_price, updated_at=now() WHERE id=1;
END $$;

CREATE TABLE public.jastip_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  origin_label text NOT NULL,
  dest_label text NOT NULL,
  depart_at timestamptz NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('paket','kursi')),
  quota integer NOT NULL CHECK (quota BETWEEN 1 AND 50),
  booked integer NOT NULL DEFAULT 0,
  price_per_slot integer NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','berjalan','selesai','dibatalkan')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jastip_trips TO authenticated;
GRANT ALL ON public.jastip_trips TO service_role;
ALTER TABLE public.jastip_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips read own or admin" ON public.jastip_trips FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.jastip_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  trip_id uuid NOT NULL REFERENCES public.jastip_trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  slots integer NOT NULL,
  price_per_slot integer NOT NULL,
  total integer NOT NULL,
  payment_method text NOT NULL,
  contact_name text NOT NULL,
  contact_wa text NOT NULL,
  notes text NOT NULL DEFAULT '',
  origin_label text NOT NULL,
  dest_label text NOT NULL,
  depart_at timestamptz NOT NULL,
  slot_type text NOT NULL,
  status text NOT NULL DEFAULT 'dipesan',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jastip_bookings TO authenticated;
GRANT ALL ON public.jastip_bookings TO service_role;
ALTER TABLE public.jastip_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings read" ON public.jastip_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'superadmin')
    OR EXISTS (SELECT 1 FROM public.jastip_trips t WHERE t.id = trip_id AND t.driver_id = auth.uid()));

-- Katalog publik tanpa identitas driver
CREATE OR REPLACE FUNCTION public.jastip_catalog()
RETURNS TABLE(id uuid, origin_label text, dest_label text, depart_at timestamptz, slot_type text, remaining integer, quota integer, price_per_slot integer, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id, t.origin_label, t.dest_label, t.depart_at, t.slot_type, t.quota - t.booked, t.quota, t.price_per_slot, t.notes
  FROM public.jastip_trips t
  WHERE t.status='open' AND t.depart_at > now() AND t.booked < t.quota
  ORDER BY t.depart_at
$$;
GRANT EXECUTE ON FUNCTION public.jastip_catalog() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.driver_create_trip(_origin text, _dest text, _depart_at timestamptz, _slot_type text, _quota integer, _price integer, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.app_settings; nid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Hanya driver terverifikasi'; END IF;
  SELECT * INTO STRICT s FROM public.app_settings WHERE id=1;
  IF length(trim(_origin))<2 OR length(trim(_dest))<2 THEN RAISE EXCEPTION 'Isi asal dan tujuan trayek'; END IF;
  IF _depart_at <= now() THEN RAISE EXCEPTION 'Jadwal berangkat harus di masa depan'; END IF;
  IF _slot_type NOT IN ('paket','kursi') THEN RAISE EXCEPTION 'Jenis slot tidak valid'; END IF;
  IF _quota < 1 OR _quota > 50 THEN RAISE EXCEPTION 'Kuota 1–50 slot'; END IF;
  IF _price < s.jastip_min_price OR _price > s.jastip_max_price THEN
    RAISE EXCEPTION 'Harga per slot harus antara Rp % dan Rp %', s.jastip_min_price, s.jastip_max_price; END IF;
  INSERT INTO public.jastip_trips(driver_id, origin_label, dest_label, depart_at, slot_type, quota, price_per_slot, notes)
  VALUES (auth.uid(), trim(_origin), trim(_dest), _depart_at, _slot_type, _quota, _price, left(coalesce(_notes,''),300))
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.driver_set_trip_status(_trip_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.jastip_trips;
BEGIN
  SELECT * INTO t FROM public.jastip_trips WHERE id=_trip_id FOR UPDATE;
  IF t.id IS NULL OR (t.driver_id <> auth.uid() AND NOT public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Jadwal tidak ditemukan'; END IF;
  IF NOT ((t.status='open' AND _status IN ('berjalan','dibatalkan')) OR (t.status='berjalan' AND _status IN ('selesai','dibatalkan'))) THEN
    RAISE EXCEPTION 'Perubahan status tidak valid'; END IF;
  UPDATE public.jastip_trips SET status=_status, updated_at=now() WHERE id=_trip_id;
  UPDATE public.jastip_bookings SET status=_status WHERE trip_id=_trip_id AND status NOT IN ('dibatalkan','selesai');
END $$;

CREATE OR REPLACE FUNCTION public.book_jastip_slot(_trip_id uuid, _slots integer, _payment text, _name text, _wa text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.jastip_trips; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk dulu'; END IF;
  IF _slots < 1 OR _slots > 10 THEN RAISE EXCEPTION 'Jumlah slot 1–10'; END IF;
  IF _payment NOT IN ('cod','transfer') THEN RAISE EXCEPTION 'Metode pembayaran tidak valid'; END IF;
  IF length(trim(coalesce(_name,'')))<2 OR coalesce(_wa,'') !~ '^(\+62|62|0)8[0-9]{6,11}$' THEN RAISE EXCEPTION 'Nama atau nomor WhatsApp tidak valid'; END IF;
  SELECT * INTO t FROM public.jastip_trips WHERE id=_trip_id FOR UPDATE;
  IF t.id IS NULL OR t.status<>'open' OR t.depart_at<=now() THEN RAISE EXCEPTION 'Jadwal tidak tersedia'; END IF;
  IF t.driver_id = auth.uid() THEN RAISE EXCEPTION 'Tidak bisa memesan jadwal sendiri'; END IF;
  IF t.booked + _slots > t.quota THEN RAISE EXCEPTION 'Sisa slot tinggal %', t.quota - t.booked; END IF;
  UPDATE public.jastip_trips SET booked = booked + _slots, updated_at=now() WHERE id=_trip_id;
  INSERT INTO public.jastip_bookings(trip_id,user_id,slots,price_per_slot,total,payment_method,contact_name,contact_wa,notes,origin_label,dest_label,depart_at,slot_type)
  VALUES (_trip_id, auth.uid(), _slots, t.price_per_slot, t.price_per_slot*_slots, _payment, trim(_name), trim(_wa), left(coalesce(_notes,''),300), t.origin_label, t.dest_label, t.depart_at, t.slot_type)
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_jastip_booking(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b public.jastip_bookings;
BEGIN
  SELECT * INTO b FROM public.jastip_bookings WHERE id=_booking_id FOR UPDATE;
  IF b.id IS NULL OR (b.user_id<>auth.uid() AND NOT public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF b.status<>'dipesan' THEN RAISE EXCEPTION 'Pesanan sudah berjalan, tidak bisa dibatalkan'; END IF;
  UPDATE public.jastip_bookings SET status='dibatalkan' WHERE id=_booking_id;
  UPDATE public.jastip_trips SET booked = greatest(0, booked - b.slots), updated_at=now() WHERE id=b.trip_id;
END $$;

-- Identitas driver hanya terbuka saat jadwal berjalan/selesai
CREATE OR REPLACE FUNCTION public.jastip_booking_driver(_booking_id uuid)
RETURNS TABLE(full_name text, phone text, vehicle_type text, vehicle_plate text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT d.full_name, d.phone, d.vehicle_type, d.vehicle_plate
  FROM public.jastip_bookings b
  JOIN public.jastip_trips t ON t.id=b.trip_id
  LEFT JOIN public.driver_profiles d ON d.user_id=t.driver_id
  WHERE b.id=_booking_id AND (b.user_id=auth.uid() OR public.has_role(auth.uid(),'superadmin'))
    AND t.status IN ('berjalan','selesai')
$$;
GRANT EXECUTE ON FUNCTION public.jastip_booking_driver(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_create_trip(text,text,timestamptz,text,integer,integer,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.book_jastip_slot(uuid,integer,text,text,text,text) FROM anon;