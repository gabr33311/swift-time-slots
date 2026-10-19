/**
 * OpenStreetMap tiles for small, non-interactive maps (the shop card on the
 * public page): no library and no key. Respect the OSM tile policy: low,
 * human-driven traffic and the "© OpenStreetMap" credit on screen.
 */
import { ARCGIS_KEY } from "@/lib/map-style";

export const TILE_SIZE = 256;
export const OSM_TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Satellite photos (Esri World Imagery), same key as the owner's map picker. */
export const SATELLITE_TILE_URL = (z: number, x: number, y: number) =>
  `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${ARCGIS_KEY}`;

/** A point in "world pixels" at a zoom level (Web Mercator). */
export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

export type TileGrid = {
  tiles: { key: string; src: string; left: number; top: number }[];
  /** Where the point sits inside the grid, in pixels (the grid is shifted so it is centred). */
  pin: { x: number; y: number };
  width: number;
  height: number;
};

/** The tiles around a point: `cols` × `rows` of them, with the point near the middle. */
export function tileGrid(
  lat: number,
  lng: number,
  zoom: number,
  cols = 5,
  rows = 3,
  url: (z: number, x: number, y: number) => string = OSM_TILE_URL,
): TileGrid {
  const p = worldPixel(lat, lng, zoom);
  const max = 2 ** zoom;
  const firstX = Math.floor(p.x / TILE_SIZE) - Math.floor(cols / 2);
  const firstY = Math.floor(p.y / TILE_SIZE) - Math.floor(rows / 2);
  const tiles: TileGrid["tiles"] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = firstX + c;
      const ty = firstY + r;
      if (ty < 0 || ty >= max) continue;
      const wrapped = ((tx % max) + max) % max;
      tiles.push({
        key: `${tx}:${ty}`,
        src: url(zoom, wrapped, ty),
        left: c * TILE_SIZE,
        top: r * TILE_SIZE,
      });
    }
  }
  return {
    tiles,
    pin: { x: p.x - firstX * TILE_SIZE, y: p.y - firstY * TILE_SIZE },
    width: cols * TILE_SIZE,
    height: rows * TILE_SIZE,
  };
}

/** Route to the shop in Google Maps (a plain link: opens the Maps app on phones, no key). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
