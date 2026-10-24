import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

type Tone = "default" | "danger";
type Base = { title: string; message?: string; confirmText?: string; cancelText?: string; tone?: Tone };
type Req =
  | (Base & { kind: "confirm"; resolve: (value: boolean) => void })
  | (Base & { kind: "prompt"; placeholder?: string; required?: boolean; initial?: string; resolve: (value: string | null) => void });

let current: Req | null = null;
const queue: Req[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function push(request: Req) {
  if (!current) { current = request; emit(); } else queue.push(request);
}
function next() { current = queue.shift() ?? null; emit(); }

/** Pengganti window.confirm. */
export function confirmDialog(options: Base): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => push({ ...options, kind: "confirm", resolve }));
}
/** Pengganti window.prompt. */
export function promptDialog(options: Base & { placeholder?: string; required?: boolean; initial?: string }): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => push({ ...options, kind: "prompt", resolve }));
}

export function ConfirmHost() {
  const req = useSyncExternalStore(subscribe, () => current, () => null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(req?.kind === "prompt" ? req.initial ?? "" : "");
    setError("");
  }, [req]);

  function finish(ok: boolean) {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(ok);
    else if (ok) {
      const text = value.trim();
      if (req.required && !text) { setError("Wajib diisi."); return; }
      req.resolve(text);
    } else req.resolve(null);
    next();
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!req) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finishRef.current(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;
  const danger = req.tone === "danger";
  return (
    <div className="mider-fade fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => finish(false)} role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="mider-dialog-title" onClick={(event) => event.stopPropagation()} className="mider-pop w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="mider-dialog-title" className="text-base font-extrabold text-foreground">{req.title}</h2>
            {req.message && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{req.message}</p>}
          </div>
        </div>
        {req.kind === "prompt" && <div className="mt-4">
          <textarea autoFocus rows={3} value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} placeholder={req.placeholder} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
        </div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => finish(false)} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-foreground active:scale-[0.98]">{req.cancelText ?? "Batal"}</button>
          <button type="button" autoFocus={req.kind === "confirm"} onClick={() => finish(true)} className={`rounded-xl px-3 py-2.5 text-sm font-bold active:scale-[0.98] ${danger ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>{req.confirmText ?? "Ya"}</button>
        </div>
      </div>
    </div>
  );
}
