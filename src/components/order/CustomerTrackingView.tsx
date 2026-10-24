import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteMap } from "@/components/order/RouteMap";
import { DriverInfoCard } from "@/components/order/DriverInfoCard";

type TrackingOrder = {
  id: string; code?: string | null; status: string; service: string;
  origin_lat: number; origin_lng: number; dest_lat: number; dest_lng: number;
  encoded_polyline?: string | null;
};
type Props = { order: TrackingOrder; chat: ReactNode; details: ReactNode };
type DriverBrief = { full_name: string; vehicle_type: string; vehicle_plate: string; photo_url: string | null };
const PEEK = 224;
const AVG_SPEED_KMH = 25;
const ROAD_FACTOR = 1.3;

function stageText(service: string, status: string) {
  if (status === "diambil") return service === "ojek" ? "Driver menuju titik jemput" : "Driver menuju lokasi pengambilan";
  if (status === "dijemput") return service === "ojek" ? "Anda sudah dijemput" : "Pesanan sudah diambil driver";
  return service === "ojek" ? "Dalam perjalanan ke tujuan" : "Pesanan sedang diantar";
}
function distanceKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const rad=(v:number)=>(v*Math.PI)/180, dLat=rad(b.lat-a.lat), dLng=rad(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2*6371*Math.asin(Math.sqrt(h))*ROAD_FACTOR;
}

export function CustomerTrackingView({ order, chat, details }: Props) {
  const [vh,setVh]=useState(800), [snap,setSnap]=useState(0), [dragY,setDragY]=useState<number|null>(null);
  const [scale,setScale]=useState(1);
  const [driverPos,setDriverPos]=useState<{lat:number;lng:number;ts:number}|null>(null), [now,setNow]=useState(Date.now());
  const rootRef=useRef<HTMLDivElement>(null);
  const startRef=useRef<{y:number;base:number;moved:boolean}|null>(null);
  const bodyRef=useRef<HTMLDivElement>(null), chatRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=rootRef.current;
    if(!el)return;
    const update=()=>{
      const h=el.clientHeight||window.innerHeight;
      setVh(h);
      setScale(Math.max(1,window.innerHeight/h));
    };
    update();
    const ro=new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize",update);
    return()=>{ro.disconnect();window.removeEventListener("resize",update);};
  },[]);
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(t);},[]);
  const {data:driver}=useQuery({
    queryKey:["order-driver-info",order.id],
    queryFn:async()=>{const {data,error}=await (supabase as any).rpc("get_order_driver_info",{_order_id:order.id});if(error)throw error;return data as DriverBrief|null;},
    enabled:!!order.id,
  });
  const sheetH=Math.round(vh*.9), positions=[sheetH-PEEK,sheetH-Math.round(vh*.56),0], y=dragY??positions[snap], visibleH=sheetH-y;
  const nextStop=useMemo(()=>order.status==="diambil"?{lat:order.origin_lat,lng:order.origin_lng}:{lat:order.dest_lat,lng:order.dest_lng},[order.status,order.origin_lat,order.origin_lng,order.dest_lat,order.dest_lng]);
  const eta=useMemo(()=>{if(!driverPos)return null;const km=distanceKm(driverPos,nextStop);if(km<.15)return "Hampir tiba";return `±${Math.max(1,Math.round(km/AVG_SPEED_KMH*60))} menit · ${km.toFixed(1)} km`;},[driverPos,nextStop]);
  const age=driverPos?Math.max(0,Math.floor((now-driverPos.ts)/1000)):null;
  const freshness=age===null?"Menunggu posisi driver…":age<=15?"Posisi langsung":age<=60?`Diperbarui ${age} detik lalu`:"Sinyal driver terputus sementara";
  const stale=age!==null&&age>60, stepIndex=["diambil","dijemput","diantar"].indexOf(order.status);
  const labels=order.service==="ojek"?["Menjemput","Dijemput","Perjalanan"]:["Menuju","Diambil","Diantar"];
  function onPointerDown(e:React.PointerEvent<HTMLDivElement>){startRef.current={y:e.clientY,base:positions[snap],moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
  function onPointerMove(e:React.PointerEvent<HTMLDivElement>){const st=startRef.current;if(!st)return;const delta=e.clientY-st.y;if(Math.abs(delta)>6)st.moved=true;setDragY(Math.min(positions[0],Math.max(0,st.base+delta)));}
  function onPointerUp(){const st=startRef.current;startRef.current=null;if(!st)return;if(!st.moved){setSnap(snap===0?1:0);setDragY(null);return;}const finalY=dragY??st.base;let best=0;positions.forEach((p,i)=>{if(Math.abs(p-finalY)<Math.abs(positions[best]-finalY))best=i;});setSnap(best);setDragY(null);}
  function openChat(){setSnap(1);window.setTimeout(()=>{if(bodyRef.current&&chatRef.current)bodyRef.current.scrollTo({top:chatRef.current.offsetTop-8,behavior:"smooth"});},300);}
  return <div ref={rootRef} className="fixed inset-0 z-[90] overflow-hidden bg-background">
    <RouteMap variant="tracking" orderId={order.id} trackingActive origin={{lat:order.origin_lat,lng:order.origin_lng}} destination={{lat:order.dest_lat,lng:order.dest_lng}} encodedPolyline={order.encoded_polyline??undefined} nextStop={nextStop} viewPadding={{top:96*scale,bottom:(PEEK+32)*scale}} recenterBottom={PEEK+16} onDriverPosition={(p,ts)=>setDriverPos({lat:p.lat,lng:p.lng,ts})} className="h-full w-full"/>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
      <Link to="/pesanan" aria-label="Kembali ke daftar pesanan" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-lg"><ArrowLeft className="h-5 w-5 text-foreground"/></Link>
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-lg"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stale?"bg-amber-500":age===null?"bg-muted-foreground":"bg-emerald-500"}`}/><p className="truncate text-sm font-bold text-foreground">{freshness}</p>{order.code&&<span className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground">#{order.code}</span>}</div>
    </div>
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border border-border bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.18)]" style={{height:sheetH,transform:`translateY(${y}px)`,transition:dragY===null?"transform 0.28s cubic-bezier(0.2,0.8,0.2,1)":"none",willChange:"transform"}}>
      <div className="flex shrink-0 cursor-grab touch-none items-center justify-center" style={{height:28}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="button" aria-label="Geser untuk membuka atau menutup panel"><span className="h-1.5 w-12 rounded-full bg-border"/></div>
      <div ref={bodyRef} className="min-h-0 overflow-x-hidden px-4 pb-[max(20px,env(safe-area-inset-bottom))]" style={{maxHeight:Math.max(0,visibleH-28),overflowY:snap===0&&dragY===null?"hidden":"auto",overscrollBehavior:"contain"}}>
        <section style={{minHeight:PEEK-36}}>
          <p className="text-base font-extrabold text-foreground">{stageText(order.service,order.status)}</p><p className="mt-0.5 text-sm font-semibold text-primary">{eta??"Menghitung perkiraan…"}</p>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Tahap pesanan">{labels.map((label,i)=><div key={label}><div className={`h-1.5 rounded-full ${i<=stepIndex?"bg-primary":"bg-muted"}`}/><p className={`mt-1 text-xs font-bold ${i<=stepIndex?"text-foreground":"text-muted-foreground"}`}>{label}</p></div>)}</div>
          <div className="mt-3 flex items-center gap-3">
            {driver?.photo_url?<img src={driver.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-primary/30 object-cover"/>:<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-extrabold text-primary">{driver?.full_name?.charAt(0)?.toUpperCase()||"D"}</div>}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-foreground">{driver?.full_name??"Driver"}</p><p className="truncate text-xs font-semibold text-muted-foreground">{driver?`${driver.vehicle_type} · ${driver.vehicle_plate}`:"Memuat data driver…"}</p></div>
            <button type="button" onClick={openChat} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"><MessageSquare className="h-4 w-4"/>Chat</button>
            <button type="button" onClick={()=>setSnap(2)} aria-label="Lihat rincian pesanan" className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground"><ReceiptText className="h-4 w-4"/></button>
          </div>
        </section>
        <div className="space-y-4 pt-4"><DriverInfoCard orderId={order.id}/><div ref={chatRef}>{chat}</div>{details}</div>
      </div>
    </div>
  </div>;
}
