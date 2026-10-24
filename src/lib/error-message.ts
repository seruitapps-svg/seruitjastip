import { toast } from "sonner";

const KNOWN: Array<[RegExp, string]> = [
  [/failed to fetch|networkerror|load failed|network request failed|fetch failed/i, "Koneksi internet terputus. Periksa jaringan Anda lalu coba lagi."],
  [/jwt expired|invalid jwt|not authenticated|unauthorized|auth session missing|refresh token/i, "Sesi login berakhir. Silakan masuk kembali."],
  [/row-level security|permission denied|forbidden|not allowed/i, "Anda tidak memiliki izin untuk melakukan tindakan ini."],
  [/duplicate key|already exists|unique constraint/i, "Data ini sudah ada."],
  [/timeout|timed out|statement timeout/i, "Server terlalu lama merespons. Silakan coba lagi."],
  [/internal server error|bad gateway|service unavailable|gateway time-?out|\b50[0-4]\b/i, "Server sedang bermasalah. Silakan coba beberapa saat lagi."],
  [/invalid input syntax|violates (foreign key|check|not-null)/i, "Data yang dikirim tidak valid. Periksa kembali isian Anda."],
];

const GENERIC = "Terjadi kendala. Silakan coba lagi.";

function pickRaw(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message;
  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "details", "hint"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return "";
}

function fromJson(text: string): string {
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return text;
  try {
    const parsed = JSON.parse(t) as unknown;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      if (typeof o.code === "string" && (o.path !== undefined || o.expected !== undefined || o.origin !== undefined)) {
        return "Data yang dikirim belum lengkap atau formatnya salah. Periksa kembali isian Anda.";
      }
      for (const key of ["message", "error", "detail"]) {
        const v = o[key];
        if (typeof v === "string" && v.trim()) return v;
      }
    }
  } catch {
    // bukan JSON valid
  }
  return GENERIC;
}

/** Mengubah error apa pun menjadi pesan yang ramah dibaca pengguna. */
export function friendlyError(input: unknown, fallback = GENERIC): string {
  let text = fromJson(pickRaw(input)).replace(/^(error|exception):\s*/i, "").trim();
  if (!text) return fallback;
  for (const [pattern, message] of KNOWN) {
    if (pattern.test(text)) return message;
  }
  if (/[{}[\]]|PGRST\d+|\bat\s+\S+\s+\(|undefined|\[object/i.test(text) || text.length > 220) return fallback;
  return text;
}

export function toastError(input: unknown, fallback?: string) {
  toast.error(friendlyError(input, fallback));
}
