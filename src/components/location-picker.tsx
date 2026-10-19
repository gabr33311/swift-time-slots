import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Minus,
  Plus,
  Satellite,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPlaces, type Place } from "@/lib/geocode";
import { MAP_STYLE, SATELLITE_CREDIT, satelliteStyle } from "@/lib/map-style";
import { usePrefs } from "@/lib/prefs";

export type LatLng = { lat: number; lng: number };

/** Lisbon: where the map opens before a place is chosen. */
const START: LatLng = { lat: 38.7223, lng: -9.1393 };

type Mode = "satellite" | "map";
const MODE_KEY = "sycras-map-mode";

/** Satellite unless the owner chose the plain map before (it is the easiest to find the door). */
function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "map" ? "map" : "satellite";
  } catch {
    return "satellite";
  }
}

/** The pin, in the app colour (a DOM element, so it follows the theme's CSS). */
function pinElement(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--brand);border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.35);cursor:grab";
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "width:30px;height:38px;display:flex;align-items:flex-start;justify-content:center";
  wrap.appendChild(el);
  return wrap;
}

/**
 * Pick the exact shop location: search an address or postal code, use the phone's
 * location, or tap / drag the pin on the map. Clients then open it in Google Maps.
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
  const map = useRef<MlMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  // The latest value, read when the map finishes loading.
  const current = useRef(value);
  current.current = value;
  // Satellite (to see the roofs) or the plain map; the plain one is light in both themes, to read well.
  const [mode, setMode] = useState<Mode>(savedMode);
  const modeRef = useRef(mode);
  const fellBack = useRef(false);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Only the town was found: say so, the pin needs a nudge.
  const [approx, setApprox] = useState(false);

  // MapLibre needs the browser: load it once the box is on screen.
  useEffect(() => {
    let cancelled = false;
    // The worker that draws the map, bundled by Vite (MapLibre cannot find it by itself here).
    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
      modeRef.current === "satellite" ? satelliteStyle().catch(() => MAP_STYLE) : MAP_STYLE,
    ]).then(([{ Map, Marker, setWorkerUrl }, worker, style]) => {
      if (cancelled || !box.current || map.current) return;
      setWorkerUrl(worker.default);
      const initial = current.current;
      const start = initial ?? START;
      const m = new Map({
        container: box.current,
        style,
        center: [start.lng, start.lat],
        zoom: initial ? 16.5 : 11,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: false,
      });
      m.touchZoomRotate.disableRotation();
      // Satellite photos failing (key expired, free tier used up, service down): back to the
      // plain map by itself, without forgetting that the owner prefers satellite.
      m.on("error", (e) => {
        if ((e as { sourceId?: string }).sourceId !== "satellite") return;
        fellBack.current = true;
        setMode("map");
      });
      const pin = new Marker({
        element: pinElement(),
        draggable: true,
        anchor: "bottom",
      }).setLngLat([start.lng, start.lat]);
      if (initial) pin.addTo(m);
      pin.on("dragend", () => {
        const p = pin.getLngLat();
        setApprox(false);
        change.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        pin.setLngLat(e.lngLat).addTo(m);
        setApprox(false);
        change.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
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
  }, []);

  // Switching between satellite and map (the pin stays where it is).
  useEffect(() => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    if (!fellBack.current) {
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {
        // Not remembered in private mode: fine.
      }
    }
    fellBack.current = false;
    if (mode === "map") map.current?.setStyle(MAP_STYLE);
    else
      void satelliteStyle()
        .then((s) => map.current?.setStyle(s))
        .catch(() => setMode("map"));
  }, [mode]);

  // A value that arrives later (saved data loading) moves the pin too.
  useEffect(() => {
    const m = map.current;
    if (!value || !marker.current || !m) return;
    const at = marker.current.getLngLat();
    if (at.lat === value.lat && at.lng === value.lng) return;
    marker.current.setLngLat([value.lng, value.lat]).addTo(m);
    m.jumpTo({ center: [value.lng, value.lat], zoom: 16.5 });
  }, [value?.lat, value?.lng]);

  function place(p: LatLng, zoom = 17) {
    const m = map.current;
    if (m && marker.current) {
      marker.current.setLngLat([p.lng, p.lat]).addTo(m);
      m.flyTo({ center: [p.lng, p.lat], zoom, speed: 1.6, essential: true });
    }
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
        setApprox(false);
        place({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const zoomBtn =
    "flex size-10 items-center justify-center text-foreground transition-colors hover:bg-muted active:bg-muted disabled:opacity-40";

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
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  place({ lat: r.lat, lng: r.lng }, r.approx ? 14 : 17.5);
                  setApprox(!!r.approx);
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

      {/* isolate: the map's own layers never cover sticky headers or bars. */}
      <div className="relative isolate z-0 h-72 overflow-hidden rounded-xl border border-border bg-muted lg:h-80">
        {/* Full size, not absolute: MapLibre makes its container position: relative. */}
        <div ref={box} className="h-full w-full" />
        {/* Zoom in the app's own style (not the map library's white squares). */}
        <div className="absolute top-2.5 right-2.5 flex flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur divide-y divide-border">
          <button
            type="button"
            className={zoomBtn}
            aria-label={t("loc.zoomIn")}
            onClick={() => map.current?.zoomIn()}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className={zoomBtn}
            aria-label={t("loc.zoomOut")}
            onClick={() => map.current?.zoomOut()}
          >
            <Minus className="size-4" />
          </button>
        </div>
        {/* Satellite (to see the roofs) or the plain map. */}
        <div className="absolute bottom-2.5 left-2.5 flex rounded-xl border border-border bg-card/95 p-1 shadow-[var(--shadow-soft)] backdrop-blur">
          {(
            [
              ["satellite", Satellite, t("loc.satellite")],
              ["map", MapIcon, t("loc.map")],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${mode === m ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {approx ? t("loc.approx") : value ? t("loc.set") : t("loc.hint")}{" "}
        {/* Required by the map licences; kept out of the map itself. */}
        <a
          href="https://openfreemap.org"
          target="_blank"
          rel="noreferrer"
          className="whitespace-nowrap opacity-70 hover:underline"
        >
          OpenFreeMap
        </a>
        {" · "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="whitespace-nowrap opacity-70 hover:underline"
        >
          © OpenStreetMap
        </a>
        {mode === "satellite" && (
          <span className="whitespace-nowrap opacity-70">
            {" "}
            · Powered by Esri · {SATELLITE_CREDIT}
          </span>
        )}
      </p>
    </div>
  );
}
