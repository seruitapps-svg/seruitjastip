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

-- Intentionally does not replace driver_advance_order here. The live database may have
-- a different function body/signature than repository migrations. Verify the active
-- definition before applying the separate PIN-policy SQL; never overwrite settlement
-- logic based only on a historical migration file.
