CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_percent numeric NOT NULL DEFAULT 10 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.driver_wallets (
  driver_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_wallets TO authenticated;
GRANT ALL ON public.driver_wallets TO service_role;
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet read" ON public.driver_wallets FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  amount integer NOT NULL,
  kind text NOT NULL,
  order_id uuid,
  note text NOT NULL DEFAULT '',
  balance_after integer NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_driver_idx ON public.wallet_transactions(driver_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet tx read" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'superadmin'));

ALTER TABLE public.orders ADD COLUMN app_fee integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN fee_charged boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.order_app_fee(_total integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT ceil(_total * commission_percent / 100.0)::int FROM public.app_settings WHERE id = 1
$$;

CREATE OR REPLACE FUNCTION public.wallet_apply(_driver uuid, _amount integer, _kind text, _order uuid, _note text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nb integer;
BEGIN
  INSERT INTO public.driver_wallets(driver_id) VALUES (_driver) ON CONFLICT DO NOTHING;
  UPDATE public.driver_wallets SET balance = balance + _amount, updated_at = now()
    WHERE driver_id = _driver RETURNING balance INTO nb;
  INSERT INTO public.wallet_transactions(driver_id, amount, kind, order_id, note, balance_after, created_by)
    VALUES (_driver, _amount, _kind, _order, COALESCE(_note,''), nb, auth.uid());
  RETURN nb;
END $$;
REVOKE EXECUTE ON FUNCTION public.wallet_apply(uuid, integer, text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_commission(_percent numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  IF _percent < 0 OR _percent > 100 THEN RAISE EXCEPTION 'Persentase harus 0–100'; END IF;
  UPDATE public.app_settings SET commission_percent = _percent, updated_at = now() WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_driver_id uuid, _amount integer, _note text DEFAULT '')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Hanya admin'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'Nominal tidak boleh 0'; END IF;
  SELECT balance INTO cur FROM public.driver_wallets WHERE driver_id = _driver_id FOR UPDATE;
  IF COALESCE(cur,0) + _amount < 0 THEN RAISE EXCEPTION 'Saldo tidak boleh minus'; END IF;
  RETURN public.wallet_apply(_driver_id, _amount, CASE WHEN _amount > 0 THEN 'topup' ELSE 'penyesuaian' END, NULL, _note);
END $$;

CREATE OR REPLACE FUNCTION public.driver_take_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.orders; fee integer; bal integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Hanya driver'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL OR o.status <> 'tersedia' OR o.driver_id IS NOT NULL THEN RAISE EXCEPTION 'Order sudah diambil driver lain'; END IF;
  fee := public.order_app_fee(o.total);
  INSERT INTO public.driver_wallets(driver_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT balance INTO bal FROM public.driver_wallets WHERE driver_id = auth.uid() FOR UPDATE;
  IF bal < fee THEN
    RAISE EXCEPTION 'Saldo tidak cukup. Biaya aplikasi order ini Rp %, saldo Anda Rp %. Silakan top-up ke admin.', fee, bal;
  END IF;
  UPDATE public.orders SET status = 'diambil', driver_id = auth.uid(), app_fee = fee, fee_charged = fee > 0 WHERE id = _order_id;
  IF fee > 0 THEN
    PERFORM public.wallet_apply(auth.uid(), -fee, 'potongan', _order_id, 'Biaya aplikasi order #' || o.code);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _note text DEFAULT ''::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF public.has_role(auth.uid(),'superadmin') THEN
    UPDATE public.orders SET status='dibatalkan', admin_note=COALESCE(_note,''), fee_charged=false
    WHERE id=_order_id AND status NOT IN ('selesai','dibatalkan','ditolak');
  ELSE
    UPDATE public.orders SET status='dibatalkan'
    WHERE id=_order_id AND user_id=auth.uid() AND status IN ('menunggu_verifikasi','tersedia');
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak bisa dibatalkan'; END IF;
  IF o.fee_charged AND o.driver_id IS NOT NULL AND o.app_fee > 0 THEN
    PERFORM public.wallet_apply(o.driver_id, o.app_fee, 'refund', _order_id, 'Pengembalian biaya, order #' || o.code || ' dibatalkan');
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_wallets;