-- Distinguish Point Resto from official Mitra Resto with structured order data.
-- Additive only: existing orders, wallet balances, and wallet_transactions are untouched.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS food_order_type text,
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_food_order_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_food_order_type_check
      CHECK (food_order_type IS NULL OR food_order_type IN ('point', 'mitra'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.food_order_type IS
  'Structured Food & Drink subtype: point means Point Resto (no Mitra PIN); mitra means official Mitra Resto (Mitra PIN required). NULL for other services.';
COMMENT ON COLUMN public.orders.merchant_id IS
  'Structured merchant identity for Food & Drink orders; never infer from item_detail.';

-- Keep one unambiguous RPC signature. The status progression and settlement
-- logic below are retained; only the PIN eligibility rule is corrected.
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

  -- Ojek keeps its own PIN-at-pickup lifecycle.
  -- Only explicitly identified official Mitra Resto requires Mitra PIN at completion.
  -- Point Resto and all other services do not use the Mitra Resto PIN rule.
  pin_required :=
    (o.service = 'ojek' AND o.status = 'diambil')
    OR (o.food_order_type = 'mitra' AND o.status = 'diantar');

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
