// Address search for the shop's map pin (free, no keys). Same file in the app.
//   1. Portuguese postal code (GeoAPI.pt, official INE/CTT addresses): the exact door.
//   2. OpenStreetMap (Nominatim).
//   3. Photon (OpenStreetMap too, more forgiving with typos and partial names).
//   4. Nothing for the street: the town, marked as approximate (the owner drags the pin).

export type Place = {
  label: string;
  lat: number;
  lng: number;
  address?: string | undefined;
  city?: string | undefined;
  /** Only the town was found: the pin needs a manual nudge. */
  approx?: boolean | undefined;
};

const POSTAL = /\b(\d{4})\s*-\s*(\d{3})\b/;
const SMALL = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);
// How the official address list shortens street types.
const STREET_TYPES: Record<string, string> = {
  R: "Rua",
  AV: "Avenida",
  PC: "Praça",
  PCT: "Praceta",
  TV: "Travessa",
  LG: "Largo",
  ESTR: "Estrada",
  EST: "Estrada",
  AL: "Alameda",
  BC: "Beco",
  CC: "Calçada",
  CAM: "Caminho",
  URB: "Urbanização",
  QTA: "Quinta",
  LUG: "Lugar",
  BR: "Bairro",
  BAIRRO: "Bairro",
  VL: "Vila",
  ZI: "Zona Industrial",
  EN: "EN",
  ER: "ER",
  IC: "IC",
};

/** Street-type words, ignored when comparing street names. */
const STREET_WORDS = new Set([
  "rua",
  "avenida",
  "praca",
  "praceta",
  "travessa",
  "largo",
  "estrada",
  "alameda",
  "beco",
  "calcada",
  "caminho",
  "urbanizacao",
  "quinta",
  "lugar",
  "bairro",
]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function streetName(raw: string): string {
  const [first = "", ...rest] = raw.trim().split(/\s+/);
  const type = STREET_TYPES[first.toUpperCase()];
  return type ? `${type} ${titleCase(rest.join(" "))}` : titleCase(raw);
}

/** Lowercase, no accents: to compare what was typed with the official names. */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function json<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type CpAnswer = {
  Localidade?: string;
  Concelho?: string;
  "Designação Postal"?: string;
  pontos?: { rua?: string; casa?: string; coordenadas?: [number, number] }[];
  centro?: [number, number];
};

async function byPostalCode(q: string): Promise<Place[]> {
  const m = POSTAL.exec(q);
  if (!m) return [];
  const cp = `${m[1]}-${m[2]}`;
  const data = await json<CpAnswer>(`https://json.geoapi.pt/cp/${cp}`);
  if (!data) return [];
  const town = titleCase(data.Localidade || data["Designação Postal"] || data.Concelho || "");
  const rest = plain(q.replace(POSTAL, " "));
  const door = /(?:^|[\s,ºnº.])(\d{1,4}[a-z]?)(?=[\s,]|$)/.exec(rest)?.[1];
  const words = rest.split(/[^a-z]+/).filter((w) => w.length > 2 && !SMALL.has(w));

  const seen = new Set<string>();
  const points = (data.pontos ?? [])
    .filter((p) => p.coordenadas && p.rua)
    .map((p) => {
      const street = plain(p.rua!);
      const score =
        (door && plain(p.casa ?? "") === door ? 3 : 0) +
        words.filter((w) => street.includes(w)).length;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter(({ p }) => {
      const key = `${p.rua}|${p.casa}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map(({ p }) => {
      const address = [streetName(p.rua!), p.casa].filter(Boolean).join(" ");
      return {
        label: `${address}, ${cp} ${town}`,
        lat: p.coordenadas![0],
        lng: p.coordenadas![1],
        address,
        city: town || undefined,
      };
    });
  if (points.length) return points;
  // A code with no doors listed: its centre, as an approximate place.
  if (data.centro) {
    return [
      {
        label: `${cp} ${town}`,
        lat: data.centro[0],
        lng: data.centro[1],
        city: town || undefined,
        approx: true,
      },
    ];
  }
  return [];
}

type NominatimRow = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

async function nominatim(q: string, approx = false): Promise<Place[]> {
  const rows = await json<NominatimRow[]>(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
    { "Accept-Language": "pt-PT,pt,en" },
  );
  return (rows ?? []).map((r) => {
    const a = r.address ?? {};
    const street = [a["road"], a["house_number"]].filter(Boolean).join(" ");
    return {
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: approx ? undefined : street || undefined,
      city: a["city"] || a["town"] || a["village"] || a["municipality"] || undefined,
      approx: approx || undefined,
    };
  });
}

type PhotonAnswer = {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: Record<string, string | undefined>;
  }[];
};

async function photon(q: string): Promise<Place[]> {
  // Leaning towards Portugal, without leaving the rest of the world out.
  const data = await json<PhotonAnswer>(
    `https://photon.komoot.io/api/?limit=5&lat=39.6&lon=-8.0&q=${encodeURIComponent(q)}`,
  );
  // The street part (before the first comma), without "rua", "avenida"…: every word must match,
  // so a similar but different street ("Chão das Eiras" for "Chão das Porteiras") is left out.
  const typed = plain(q.split(",")[0] ?? q)
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !SMALL.has(w) && !STREET_WORDS.has(w));
  return (data?.features ?? [])
    .filter((f) => {
      const name = plain(`${f.properties["name"] ?? ""} ${f.properties["street"] ?? ""}`);
      return typed.every((w) => name.includes(w));
    })
    .map((f) => {
      const p = f.properties;
      const street = [p["street"] ?? p["name"], p["housenumber"]].filter(Boolean).join(" ");
      const city = p["city"] ?? p["town"] ?? p["village"] ?? p["county"];
      return {
        label: [street, [p["postcode"], city].filter(Boolean).join(" "), p["country"]]
          .filter(Boolean)
          .join(", "),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        address: street || undefined,
        city: city || undefined,
      };
    });
}

/** The town part of an address ("Rua X 5, Vila Real" → "Vila Real"). */
function townOf(q: string): string | null {
  const parts = q
    .replace(POSTAL, " ")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1]!;
  return null;
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  for (const step of [byPostalCode, nominatim, photon]) {
    const found = await step(query);
    if (found.length) return found;
  }
  const town = townOf(query);
  return town ? nominatim(town, true) : [];
}
