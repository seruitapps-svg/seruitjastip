import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { placesAutocomplete, placeDetails } from "@/lib/maps.functions";

export interface SelectedPlace {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  label: string;
  placeholder: string;
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
}

export function PlaceAutocomplete({ label, placeholder, value, onChange }: Props) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; text: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (value && text === value.address) {
      setSuggestions([]);
      return;
    }
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    const id = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const results = await placesAutocomplete({
          data: { input: text, sessionToken: sessionTokenRef.current },
        });
        if (id !== requestIdRef.current) return; // respons basi, abaikan
        setSuggestions(results);
        setOpen(true);
        setError("");
      } catch (err) {
        if (id !== requestIdRef.current) return;
        setSuggestions([]);
        setError(err instanceof Error ? err.message : "Gagal mencari alamat");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, value]);

  async function pick(placeId: string, text: string) {
    setOpen(false);
    setLoading(true);
    setError("");
    try {
      const detail = await placeDetails({
        data: { placeId, sessionToken: sessionTokenRef.current },
      });
      // token sesi dipensiun setelah details berhasil
      sessionTokenRef.current = crypto.randomUUID();
      onChange(detail);
      setQuery(detail.address || text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil lokasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          maxLength={120}
          className="w-full rounded-lg border border-input bg-card py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Memuat…
          </span>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => pick(s.placeId, s.text)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {value && !error && (
        <p className="mt-1 text-xs text-muted-foreground">📍 {value.address}</p>
      )}
    </div>
  );
}
