/** Google Maps link for clients: exact pin when there is one, address otherwise. */
export function mapsUrl(opts: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  name?: string | null;
}): string | null {
  if (opts.latitude != null && opts.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.latitude},${opts.longitude}`;
  }
  const q = [opts.name, opts.address].filter(Boolean).join(", ");
  return opts.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : null;
}
