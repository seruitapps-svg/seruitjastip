import { useState } from "react";
import { Receipt, Upload, Loader2, CheckCircle2, Image as ImageIcon, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/config";
import { uploadCompressedMedia } from "@/lib/image-compressor";
import type { OrderRow } from "@/lib/order-status";

interface Props {
  order: OrderRow;
  onSuccess: () => void;
}

export function DriverItemCostCard({ order, onSuccess }: Props) {
  const currentCost = Number((order as any).item_cost ?? 0);
  const currentReceipt = ((order as any).item_receipt_url as string | null) ?? null;
  const [amount, setAmount] = useState(currentCost > 0 ? String(currentCost) : "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [noReceiptAvailable, setNoReceiptAvailable] = useState(false);

  const isEditable = ["diambil", "dijemput", "diantar"].includes(order.status);
  const detailText = (order.item_detail || "").toLowerCase();
  const isLikelyFood =
    order.service === "food" ||
    order.service === "point_food" ||
    detailText.includes("point resto") ||
    detailText.includes("porsi") ||
    detailText.includes("resto") ||
    detailText.includes("makan") ||
    detailText.includes("minum");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const parsed = Number.parseInt(amount.replace(/\D/g, ""), 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      setError("Masukkan nominal yang valid (isi 0 jika tidak ada talangan).");
      return;
    }

    if (!isLikelyFood && !noReceiptAvailable && parsed > 0 && !file && !currentReceipt) {
      setError("Lampirkan foto struk kasir, atau centang pilihan 'Warung/toko tidak menyediakan struk'.");
      return;
    }

    setLoading(true);
    try {
      let receiptUrl = currentReceipt;
      if (file) {
        try {
          receiptUrl = await uploadCompressedMedia(
            "payment-proofs",
            `receipts/${order.id}`,
            "struk",
            file,
            { maxWidth: 1024, quality: 0.75 },
          );
        } catch (uploadErr: unknown) {
          console.warn("Kompresi gagal, mencoba upload file asli:", uploadErr);
          const ext = file.name.split(".").pop() || "jpg";
          const fallbackPath = `receipts/${order.id}/struk_raw_${Date.now()}.${ext}`;
          const { error: rawErr } = await supabase.storage
            .from("payment-proofs")
            .upload(fallbackPath, file, { contentType: file.type || "application/octet-stream", upsert: true });

          if (rawErr) {
            throw new Error(`Gagal upload foto ke storage: ${rawErr.message}. Pastikan bucket payment-proofs sudah dibuat di Supabase.`);
          }

          const { data: publicUrlData } = supabase.storage
            .from("payment-proofs")
            .getPublicUrl(fallbackPath);
          receiptUrl = publicUrlData.publicUrl;
        }
      }

      const { error: rpcErr } = await (supabase.rpc as any)("driver_set_order_item_cost", {
        _order_id: order.id,
        _item_cost: parsed,
        _receipt_url: receiptUrl,
      });
      if (rpcErr) throw rpcErr;

      setSuccessMsg("Nominal & data berhasil disimpan.");
      setFile(null);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data belanjaan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">
          {isLikelyFood ? "Harga Makanan (Point Resto)" : "Talangan Belanja"}
        </h3>
      </div>

      <p className="text-xs text-muted-foreground">
        {isLikelyFood
          ? "Masukkan harga makanan riil dari warung/resto. Foto struk bersifat opsional."
          : "Masukkan harga barang belanjaan riil sesuai struk kasir."}
      </p>

      {currentCost > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 text-xs">
          <span className="text-muted-foreground">Nominal tercatat:</span>
          <span className="font-bold text-foreground">{formatRupiah(currentCost)}</span>
        </div>
      )}

      {currentReceipt && (
        <a href={currentReceipt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary underline">
          <ImageIcon className="h-3.5 w-3.5" /> Lihat Foto Struk Terunggah
        </a>
      )}

      {isEditable ? (
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div>
            <label htmlFor={`item-cost-${order.id}`} className="text-xs font-semibold text-foreground">
              Nominal {isLikelyFood ? "Harga Makanan" : "Belanja"} (Rp)
            </label>
            <input
              id={`item-cost-${order.id}`}
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 35000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={`item-receipt-${order.id}`} className="text-xs font-semibold text-foreground">
                Foto Struk Kasir {isLikelyFood || noReceiptAvailable ? "(Opsional)" : "(Wajib)"}
              </label>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Camera className="h-3 w-3" /> Kamera / Galeri
              </span>
            </div>
            <input
              id={`item-receipt-${order.id}`}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
              disabled={loading}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-foreground">
            <input
              type="checkbox"
              checked={noReceiptAvailable}
              onChange={(e) => setNoReceiptAvailable(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
              disabled={loading}
            />
            <span>Warung / toko tidak menyediakan struk cetak</span>
          </label>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {successMsg && (
            <p role="status" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />{successMsg}
            </p>
          )}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Menyimpan..." : "Simpan Nominal & Struk"}
          </button>
        </form>
      ) : (
        <p className="text-xs italic text-muted-foreground">Data belanja terkunci karena status pesanan sudah selesai.</p>
      )}
    </section>
  );
}
