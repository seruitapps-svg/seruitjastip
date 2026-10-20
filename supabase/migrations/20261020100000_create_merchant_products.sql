-- Product catalog owned by each authenticated merchant.
-- Existing merchant records and storage buckets are not modified.
CREATE TABLE IF NOT EXISTS public.merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_products_merchant_id_idx
  ON public.merchant_products (merchant_id);

ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mitra can view own products" ON public.merchant_products;
CREATE POLICY "Mitra can view own products"
  ON public.merchant_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = merchant_products.merchant_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Mitra can insert own products" ON public.merchant_products;
CREATE POLICY "Mitra can insert own products"
  ON public.merchant_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = merchant_products.merchant_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Mitra can update own products" ON public.merchant_products;
CREATE POLICY "Mitra can update own products"
  ON public.merchant_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = merchant_products.merchant_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = merchant_products.merchant_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Mitra can delete own products" ON public.merchant_products;
CREATE POLICY "Mitra can delete own products"
  ON public.merchant_products
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = merchant_products.merchant_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'approved'
    )
  );
