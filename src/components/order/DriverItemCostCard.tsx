import { useState } from "react";
import { Receipt, Upload, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";
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

  const isEditable = ["diambil", "dijemput"].includes(order.status);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const parsed = Number.parseInt(amount.replace(/\D/g, ""), 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      setError("Masukkan nominal belanja yang valid (bisa 0 jika tidak ada).");
      return;
    }

    setLoading(true);
    try {
      let receiptUrl = currentReceipt;
      if (file) {
        receiptUrl = await uploadCompressedMedia(
          "payment-proofs",
          `receipts/${order.id}`,
          "struk",
          file,
          { maxWidth: 1024, quality: 0.75 },
        );
      }

      const { error: rpcErr } = await (supabase.rpc as any)("driver_set_order_item_cost", {
        _order_id: order.id,
        _item_cost: parsed,
        _receipt_url: receiptUrl,
      });
      if (rpcErr) throw rpcErr;

      setSuccessMsg("Biaya talangan & struk berhasil disimpan.");
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
        <h3 className="text-sm font-bold text-foreground">Talangan Belanja / Point Resto</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Masukkan harga riil barang sesuai struk kasir. Uang talangan 100% diganti tanpa potongan komisi.
      </p>

      {currentCost > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 text-xs">
          <span className="text-muted-foreground">Nominal tercatat:</span>
          <span className="font-bold text-foreground">{formatRupiah(currentCost)}</span>
        </div>
      )}
      {currentReceipt && (
        <a href={currentReceipt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary underline">
          <ImageIcon className="h-3.5 w-3.5" /> Lihat Struk Kasir Terunggah
        </a>
      )}

      {isEditable ? (
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div>
            <label htmlFor={`item-cost-${order.id}`} className="text-xs font-semibold text-foreground">Nominal Riil Belanja (Rp)</label>
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
            <label htmlFor={`item-receipt-${order.id}`} className="text-xs font-semibold text-foreground">Foto Struk / Nota (Opsional jika sama)</label>
            <input
              id={`item-receipt-${order.id}`}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
              disabled={loading}
            />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {successMsg && <p role="status" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{successMsg}</p>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Menyimpan..." : "Simpan Nominal & Struk"}
          </button>
        </form>
      ) : (
        <p className="text-xs italic text-muted-foreground">Data belanja terkunci karena status pesanan sudah diantar/selesai.</p>
      )}
    </section>
  );
}
