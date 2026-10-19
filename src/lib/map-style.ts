// Map looks for the owner's location picker: the plain map and satellite.
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/** OpenFreeMap "liberty": free vector map, no key or limits (commercial use allowed). */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Esri World Imagery (ArcGIS Location Platform, free tier). A public key: it ships in the
 * site and the app, and is meant to be limited to sycras.com in the ArcGIS settings.
 * Expires on 19/10/2027 — replace it before then.
 */
export const ARCGIS_KEY =
  "AAPTaoDalaECyKu_r5agDCjR48A..owTXA-KcdiHFknF1gSE4Cyv5epb6uX-6i05EPfD7XWVVB7oW-VM3umkcUGj_hMEFqeMmz0XoKACXHIpWOfgO3nY4HyD-W4hSr13FkL6Vig1rwdlWlqGPqDkBsW_-Rsgyfk1Hz2_4zuP53Xu4to0i38rjUXMB3b27kisoEYepuirvYPKXjbX3rwnREfxntTE5RPbwrrZj53FtTMNJHaH7nfaGmBw7FVDtpR2ZQdoG2TJIRgwihKDuAT1_YdWc5r80";

export const SATELLITE_TILES = `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`;

/** Required credit for the imagery. */
export const SATELLITE_CREDIT = "Esri, Maxar, Earthstar Geographics";

let cached: Promise<StyleSpecification> | null = null;

/**
 * Satellite photos with the street and place names of the plain map on top,
 * so the owner sees the roofs and still knows which street is which.
 */
export function satelliteStyle(): Promise<StyleSpecification> {
  cached ??= fetch(MAP_STYLE)
    .then((r) => r.json() as Promise<StyleSpecification>)
    .then((base) => {
      const labels = base.layers.filter(
        (l): l is LayerSpecification => l.type === "symbol" && !/poi|aeroway|water_name/.test(l.id),
      );
      return {
        ...base,
        sources: {
          ...base.sources,
          satellite: {
            type: "raster",
            tiles: [SATELLITE_TILES],
            tileSize: 256,
            maxzoom: 19,
            attribution: SATELLITE_CREDIT,
          },
        },
        layers: [{ id: "satellite", type: "raster", source: "satellite" }, ...labels],
      } satisfies StyleSpecification;
    })
    .catch((e: unknown) => {
      cached = null;
      throw e;
    });
  return cached;
}
