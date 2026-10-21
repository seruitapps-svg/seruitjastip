-- Keep one unambiguous driver_advance_order signature and align PIN checks with the
-- approved Mider passenger-ride flow: PIN at pickup for ojek, not at trip completion.
-- Non-ojek delivery orders retain their existing completion PIN check.

DROP FUNCTION IF EXISTS public.driver_advance_order(uuid);

CREATE OR REPLACE FUNCTION public.driver_advance_order(
  _order_id uuid,
  _pin text DEFAULT NULL
)
RETURNS public.order_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  nxt public.order_status;
  net integer;
  nb integer;
  pin_required boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'driver') THEN
    RAISE EXCEPTION 'Hanya driver yang dapat memperbarui status order.';
  END IF;

  SELECT *
    INTO o
    FROM public.orders
   WHERE id = _order_id
     AND driver_id = auth.uid()
   FOR UPDATE;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Bukan order Anda.';
  END IF;

  -- PIN is checked when an ojek passenger is picked up.
  -- Other delivery services keep their existing PIN-at-completion behavior.
  pin_required :=
    (o.service = 'ojek' AND o.status = 'diambil')
    OR (o.service <> 'ojek' AND o.status = 'diantar');

  IF pin_required THEN
    IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'Masukkan 4 digit PIN konfirmasi dari pelanggan.';
    END IF;

    IF COALESCE(o.confirmation_pin, '') <> _pin THEN
      RAISE EXCEPTION 'PIN konfirmasi salah. Minta PIN yang benar dari pemesan.';
    END IF;
  END IF;

  nxt := CASE o.status
    WHEN 'diambil' THEN 'dijemput'::public.order_status
    WHEN 'dijemput' THEN 'diantar'::public.order_status
    WHEN 'diantar' THEN 'selesai'::public.order_status
  END;

  IF nxt IS NULL THEN
    RAISE EXCEPTION 'Status order tidak bisa dilanjutkan.';
  END IF;

  IF nxt = 'selesai'
     AND NOT o.earnings_credited
     AND (o.monetization_version = 0 OR o.payment_method = 'transfer') THEN
    net := CASE
      WHEN o.monetization_version = 1 THEN o.driver_net_earnings
      ELSE o.total - o.app_fee
    END;

    INSERT INTO public.driver_wallets(driver_id)
    VALUES (auth.uid())
    ON CONFLICT DO NOTHING;

    UPDATE public.driver_wallets
       SET earnings_balance = earnings_balance + net,
           updated_at = now()
     WHERE driver_id = auth.uid()
     RETURNING earnings_balance INTO nb;

    INSERT INTO public.wallet_transactions(
      driver_id, amount, kind, order_id, note, balance_after, created_by, balance_type
    )
    VALUES (
      auth.uid(), net, 'penghasilan', o.id,
      'Penghasilan #' || o.code, nb, auth.uid(), 'earnings'
    );

    UPDATE public.orders
       SET earnings_credited = true
     WHERE id = o.id;
  END IF;

  UPDATE public.orders
     SET status = nxt,
         updated_at = now()
   WHERE id = o.id;

  RETURN nxt;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_advance_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_advance_order(uuid, text) TO authenticated;
