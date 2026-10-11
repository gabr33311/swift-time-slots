import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrefs } from "@/lib/prefs";

export type LatLng = { lat: number; lng: number };
type Place = {
  label: string;
  lat: number;
  lng: number;
  address?: string | undefined;
  city?: string | undefined;
};

/** Lisbon: where the map opens before a place is chosen. */
const START: LatLng = { lat: 38.7223, lng: -9.1393 };

/** Address search through OpenStreetMap (free, no key). */
async function searchPlaces(q: string): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-PT,pt,en" } });
  if (!res.ok) return [];
  const rows = (await res.json()) as {
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }[];
  return rows.map((r) => {
    const a = r.address ?? {};
    const street = [a["road"], a["house_number"]].filter(Boolean).join(" ");
    return {
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: street || undefined,
      city: a["city"] || a["town"] || a["village"] || a["municipality"] || undefined,
    };
  });
}

/**
 * Pick the exact shop location: search an address, use the phone's location,
 * or tap / drag the pin on the map. Clients then open it in Google Maps.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
  initialQuery = "",
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  /** Called with the street and city of a searched place (to fill empty fields). */
  onAddress?: (address?: string, city?: string) => void;
  initialQuery?: string;
}) {
  const { t } = usePrefs();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  // The latest value, read when the map finishes loading.
  const current = useRef(value);
  current.current = value;
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Leaflet needs the browser: load it once the box is on screen.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      const initial = current.current;
      const start = initial ?? START;
      const m = L.map(box.current, { zoomControl: true, attributionControl: false }).setView(
        [start.lat, start.lng],
        initial ? 17 : 12,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--brand);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const pin = L.marker([start.lat, start.lng], {
        draggable: true,
        icon,
        opacity: initial ? 1 : 0,
      });
      pin.addTo(m);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        change.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        pin.setLatLng(e.latlng).setOpacity(1);
        change.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
      marker.current = pin;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; later moves go through `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value that arrives later (saved data loading) moves the pin too.
  useEffect(() => {
    if (!value || !marker.current) return;
    const at = marker.current.getLatLng();
    if (at.lat === value.lat && at.lng === value.lng) return;
    marker.current.setLatLng([value.lat, value.lng]).setOpacity(1);
    map.current?.setView([value.lat, value.lng], 17);
  }, [value?.lat, value?.lng]);

  function place(p: LatLng, zoom = 17) {
    marker.current?.setLatLng([p.lat, p.lng]).setOpacity(1);
    map.current?.setView([p.lat, p.lng], zoom);
    onChange(p);
  }

  async function search() {
    if (query.trim().length < 3) return;
    setBusy(true);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        place({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder={t("loc.search")}
          aria-label={t("loc.search")}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void search()}
          aria-label={t("loc.searchBtn")}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={locate}
          aria-label={t("loc.here")}
          disabled={busy}
        >
          <LocateFixed />
        </Button>
      </div>

      {results && (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{t("loc.none")}</li>
          )}
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  place({ lat: r.lat, lng: r.lng });
                  onAddress?.(r.address, r.city);
                  setResults(null);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                <span className="line-clamp-2">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* isolate: Leaflet's own layers never cover sticky headers or bars. */}
      <div
        ref={box}
        className="relative isolate z-0 h-60 overflow-hidden rounded-xl border border-border bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        {value ? t("loc.set") : t("loc.hint")}{" "}
        {/* Required by the OpenStreetMap licence; kept out of the map itself. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="whitespace-nowrap opacity-70 hover:underline"
        >
          Mapa © OpenStreetMap
        </a>
      </p>
    </div>
  );
}
