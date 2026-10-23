-- Restrict private driver-location broadcasts to the assigned driver and order owner.
-- The topic format must match the client channel: tracking-<order UUID>.
DROP POLICY IF EXISTS "authorized users can receive driver tracking broadcasts" ON realtime.messages;
CREATE POLICY "authorized users can receive driver tracking broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND realtime.topic() LIKE 'tracking-%'
  AND EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id::text = substring(realtime.topic() FROM 10)
      AND o.status IN ('diambil', 'dijemput', 'diantar')
      AND (
        o.user_id = auth.uid()
        OR o.driver_id = auth.uid()
        OR public.has_role(auth.uid(), 'superadmin')
      )
  )
);

DROP POLICY IF EXISTS "assigned driver can publish tracking broadcasts" ON realtime.messages;
CREATE POLICY "assigned driver can publish tracking broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'broadcast'
  AND realtime.topic() LIKE 'tracking-%'
  AND EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id::text = substring(realtime.topic() FROM 10)
      AND o.driver_id = auth.uid()
      AND o.status IN ('diambil', 'dijemput', 'diantar')
  )
);
