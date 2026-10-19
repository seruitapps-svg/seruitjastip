-- Mitra Resto Resmi: pendaftaran, verifikasi, kepemilikan, dan katalog aman
-- Tidak mengubah perilaku data Point Resto yang sudah ada.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_note text;

-- Point Resto lama tetap dianggap aktif dan tidak masuk antrean verifikasi mitra.
UPDATE public.merchants
SET verification_status = 'approved'
WHERE type = 'point_resto' AND verification_status = 'pending';

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_verification_status_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_verification_status_check
  CHECK (verification_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS merchants_owner_id_idx ON public.merchants(owner_id);
CREATE INDEX IF NOT EXISTS merchants_official_catalog_idx
  ON public.merchants(type, verification_status, is_open);

CREATE TABLE IF NOT EXISTS public.merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  description text NOT NULL DEFAULT '',
  price integer NOT NULL CHECK (price >= 0),
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_products_catalog_idx
  ON public.merchant_products(merchant_id, is_available);

ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_products TO authenticated;
GRANT SELECT ON public.merchant_products TO anon;
GRANT ALL ON public.merchant_products TO service_role;

DROP POLICY IF EXISTS "merchant products public catalog" ON public.merchant_products;
CREATE POLICY "merchant products public catalog"
  ON public.merchant_products FOR SELECT TO anon, authenticated
  USING (
    is_available = true AND EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_id
        AND m.type = 'official_mitra'
        AND m.verification_status = 'approved'
        AND m.is_open = true
    )
    OR EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_id AND m.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

DROP POLICY IF EXISTS "merchant owners add own products" ON public.merchant_products;
CREATE POLICY "merchant owners add own products"
  ON public.merchant_products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_id AND m.owner_id = auth.uid()
        AND m.type = 'official_mitra' AND m.verification_status = 'approved')
  );

DROP POLICY IF EXISTS "merchant owners update own products" ON public.merchant_products;
CREATE POLICY "merchant owners update own products"
  ON public.merchant_products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.owner_id = auth.uid() AND m.verification_status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.owner_id = auth.uid() AND m.verification_status = 'approved'));

DROP POLICY IF EXISTS "merchant owners delete own products" ON public.merchant_products;
CREATE POLICY "merchant owners delete own products"
  ON public.merchant_products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.owner_id = auth.uid() AND m.verification_status = 'approved'));

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.merchants TO authenticated;
GRANT SELECT ON public.merchants TO anon;

DROP POLICY IF EXISTS "official merchants public catalog" ON public.merchants;
CREATE POLICY "official merchants public catalog"
  ON public.merchants FOR SELECT TO anon, authenticated
  USING (
    (type = 'official_mitra' AND verification_status = 'approved' AND is_open = true)
    OR (owner_id = auth.uid())
    OR (type = 'point_resto' AND public.has_role(auth.uid(), 'superadmin'))
    OR public.has_role(auth.uid(), 'superadmin')
  );

DROP POLICY IF EXISTS "users submit official merchant application" ON public.merchants;
CREATE POLICY "users submit official merchant application"
  ON public.merchants FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND type = 'official_mitra'
    AND verification_status = 'pending'
    AND is_open = false
  );

DROP POLICY IF EXISTS "owners update own pending application" ON public.merchants;
CREATE POLICY "owners update own pending application"
  ON public.merchants FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND type = 'official_mitra' AND verification_status IN ('pending','rejected'))
  WITH CHECK (owner_id = auth.uid() AND type = 'official_mitra' AND verification_status IN ('pending','rejected') AND is_open = false);

DROP POLICY IF EXISTS "superadmin manages merchants" ON public.merchants;
CREATE POLICY "superadmin manages merchants"
  ON public.merchants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
