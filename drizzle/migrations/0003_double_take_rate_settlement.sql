ALTER TABLE public.orders ADD COLUMN consumer_service_fee integer NOT NULL DEFAULT 0, ADD COLUMN shipping_fare integer NOT NULL DEFAULT 0, ADD COLUMN driver_commission integer NOT NULL DEFAULT 0, ADD COLUMN commission_percent numeric NOT NULL DEFAULT 0, ADD COLUMN driver_net_earnings integer NOT NULL DEFAULT 0, ADD COLUMN deposit_deduction integer NOT NULL DEFAULT 0, ADD COLUMN monetization_version integer NOT NULL DEFAULT 0, ADD COLUMN earnings_credited boolean NOT NULL DEFAULT false;
ALTER TABLE public.wallet_transactions ADD COLUMN balance_type text NOT NULL DEFAULT 'deposit';
UPDATE public.orders SET shipping_fare=total,driver_commission=app_fee,driver_net_earnings=greatest(0,total-app_fee),deposit_deduction=CASE WHEN fee_charged THEN app_fee ELSE 0 END,earnings_credited=(status='selesai');
UPDATE public.orders o SET monetization_version=1,consumer_service_fee=o.base_fare,shipping_fare=o.distance_fare+o.oversize_fee,commission_percent=s.commission_percent,driver_commission=ceil((o.distance_fare+o.oversize_fee)*s.commission_percent/100.0)::integer,driver_net_earnings=(o.distance_fare+o.oversize_fee)-ceil((o.distance_fare+o.oversize_fee)*s.commission_percent/100.0)::integer,app_fee=o.base_fare+ceil((o.distance_fare+o.oversize_fee)*s.commission_percent/100.0)::integer,deposit_deduction=CASE WHEN o.payment_method='cod' THEN o.base_fare+ceil((o.distance_fare+o.oversize_fee)*s.commission_percent/100.0)::integer ELSE 0 END FROM public.app_settings s WHERE s.id=1 AND o.driver_id IS NULL AND o.status IN ('menunggu_verifikasi','tersedia');
CREATE OR REPLACE FUNCTION public.snapshot_order_fees() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.app_settings; BEGIN
SELECT * INTO STRICT s FROM public.app_settings WHERE id=1;
IF NEW.payment_method NOT IN ('cod','transfer') OR NEW.distance_meters<0 THEN RAISE EXCEPTION 'Data pembayaran atau jarak tidak valid'; END IF;
NEW.base_fare:=s.base_fare; NEW.distance_fare:=greatest(1,ceil(NEW.distance_meters/1000.0))::integer*s.per_km;
NEW.oversize_fee:=CASE WHEN NEW.weight_kg>5 OR NEW.length_cm>100 OR NEW.width_cm>100 OR NEW.height_cm>100 THEN s.oversize_fee ELSE 0 END;
NEW.consumer_service_fee:=NEW.base_fare; NEW.shipping_fare:=NEW.distance_fare+NEW.oversize_fee; NEW.total:=NEW.shipping_fare+NEW.consumer_service_fee; NEW.commission_percent:=s.commission_percent;
NEW.driver_commission:=ceil(NEW.shipping_fare*s.commission_percent/100.0)::integer; NEW.driver_net_earnings:=NEW.shipping_fare-NEW.driver_commission; NEW.app_fee:=NEW.consumer_service_fee+NEW.driver_commission;
NEW.deposit_deduction:=CASE WHEN NEW.payment_method='cod' THEN NEW.app_fee ELSE 0 END; NEW.monetization_version:=1; NEW.fee_charged:=false; NEW.earnings_credited:=false; RETURN NEW; END $$;
CREATE TRIGGER snapshot_order_fees BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_fees();
CREATE OR REPLACE FUNCTION public.driver_take_order(_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.orders; deduction integer; bal integer; BEGIN
IF NOT public.has_role(auth.uid(),'driver') THEN RAISE EXCEPTION 'Hanya driver'; END IF;
SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
IF o.id IS NULL OR o.status<>'tersedia' OR o.driver_id IS NOT NULL THEN RAISE EXCEPTION 'Order sudah diambil driver lain'; END IF;
deduction:=CASE WHEN o.monetization_version=1 THEN o.deposit_deduction ELSE public.order_app_fee(o.total) END;
INSERT INTO public.driver_wallets(driver_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
SELECT balance INTO bal FROM public.driver_wallets WHERE driver_id=auth.uid() FOR UPDATE;
IF bal<deduction THEN RAISE EXCEPTION 'Saldo deposit tidak cukup. Diperlukan Rp %, tersedia Rp %.',deduction,bal; END IF;
UPDATE public.orders SET status='diambil',driver_id=auth.uid(),fee_charged=(deduction>0),deposit_deduction=deduction,app_fee=CASE WHEN o.monetization_version=0 THEN deduction ELSE o.app_fee END WHERE id=_order_id;
IF deduction>0 THEN PERFORM public.wallet_apply(auth.uid(),-deduction,'potongan',_order_id,'Biaya layanan + komisi #'||o.code); END IF; END $$;
CREATE OR REPLACE FUNCTION public.driver_advance_order(_order_id uuid) RETURNS public.order_status LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.orders; nxt public.order_status; net integer; nb integer; BEGIN
SELECT * INTO o FROM public.orders WHERE id=_order_id AND driver_id=auth.uid() FOR UPDATE;
IF o.id IS NULL THEN RAISE EXCEPTION 'Bukan order Anda'; END IF;
nxt:=CASE o.status WHEN 'diambil' THEN 'dijemput'::public.order_status WHEN 'dijemput' THEN 'diantar'::public.order_status WHEN 'diantar' THEN 'selesai'::public.order_status END;
IF nxt IS NULL THEN RAISE EXCEPTION 'Status tidak bisa dilanjutkan'; END IF;
IF nxt='selesai' AND NOT o.earnings_credited AND (o.monetization_version=0 OR o.payment_method='transfer') THEN
net:=CASE WHEN o.monetization_version=1 THEN o.driver_net_earnings ELSE o.total-o.app_fee END;
INSERT INTO public.driver_wallets(driver_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
UPDATE public.driver_wallets SET earnings_balance=earnings_balance+net,updated_at=now() WHERE driver_id=auth.uid() RETURNING earnings_balance INTO nb;
INSERT INTO public.wallet_transactions(driver_id,amount,kind,order_id,note,balance_after,created_by,balance_type) VALUES(auth.uid(),net,'penghasilan',o.id,'Penghasilan #'||o.code,nb,auth.uid(),'earnings');
UPDATE public.orders SET earnings_credited=true WHERE id=o.id; END IF;
UPDATE public.orders SET status=nxt,updated_at=now() WHERE id=o.id; RETURN nxt; END $$;
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid,_note text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o public.orders; BEGIN
SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
IF o.id IS NULL OR o.status IN ('selesai','dibatalkan','ditolak') THEN RAISE EXCEPTION 'Pesanan tidak bisa dibatalkan'; END IF;
IF NOT public.has_role(auth.uid(),'superadmin') AND NOT (o.user_id=auth.uid() AND o.status IN ('menunggu_verifikasi','tersedia')) THEN RAISE EXCEPTION 'Pesanan tidak bisa dibatalkan'; END IF;
IF o.fee_charged AND o.driver_id IS NOT NULL AND o.deposit_deduction>0 THEN PERFORM public.wallet_apply(o.driver_id,o.deposit_deduction,'refund',o.id,'Pengembalian #'||o.code); END IF;
UPDATE public.orders SET status='dibatalkan',admin_note=CASE WHEN public.has_role(auth.uid(),'superadmin') THEN coalesce(_note,'') ELSE admin_note END,fee_charged=false WHERE id=o.id; END $$;
REVOKE ALL ON FUNCTION public.snapshot_order_fees() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_take_order(uuid),public.driver_advance_order(uuid),public.cancel_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_take_order(uuid),public.driver_advance_order(uuid),public.cancel_order(uuid,text) TO authenticated;
COMMENT ON COLUMN public.orders.base_fare IS 'Consumer flat service fee; excluded from shipping for version 1';
COMMENT ON COLUMN public.orders.app_fee IS 'Platform revenue: service fee plus driver commission for version 1; legacy commission for version 0';