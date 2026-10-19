-- Live tracking driver berbasis web: satu posisi terbaru per pesanan.
CREATE TABLE IF NOT EXISTS public.driver_locations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy double precision,
  heading double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_locations_driver_idx ON public.driver_locations(driver_id);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver locations read authorized" ON public.driver_locations;
CREATE POLICY "driver locations read authorized"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND (
        public.has_role(auth.uid(), 'superadmin')
        OR (
          o.status IN ('diambil', 'dijemput', 'diantar')
          AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS "driver locations insert own active order" ON public.driver_locations;
CREATE POLICY "driver locations insert own active order"
ON public.driver_locations FOR INSERT TO authenticated
WITH CHECK (
  driver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND o.driver_id = auth.uid()
      AND o.status IN ('diambil', 'dijemput', 'diantar')
  )
);

DROP POLICY IF EXISTS "driver locations update own active order" ON public.driver_locations;
CREATE POLICY "driver locations update own active order"
ON public.driver_locations FOR UPDATE TO authenticated
USING (
  driver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND o.driver_id = auth.uid()
      AND o.status IN ('diambil', 'dijemput', 'diantar')
  )
)
WITH CHECK (
  driver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND o.driver_id = auth.uid()
      AND o.status IN ('diambil', 'dijemput', 'diantar')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
  END IF;
END $$;
