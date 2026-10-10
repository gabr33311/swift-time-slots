/** Portuguese mobile mask: digits only, grouped as `912 345 678` (+351 implicit). */
export function maskPhonePt(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^351/, "").slice(0, 9);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  return parts.join(" ");
}

/** Normalised value for storage: `+351912345678` when it looks like a PT mobile. */
export function normalizePhonePt(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  if (digits.length === 9) return `+351${digits}`;
  return masked.trim();
}

/**
 * Storage/lookup form for customer phones, so the same person is found again
 * whatever way the number was typed: PT mobiles as `912 345 678` (the format the
 * public booking page has always stored), anything else just trimmed.
 */
export function canonicalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return maskPhonePt(digits);
  if (digits.length === 12 && digits.startsWith("351")) return maskPhonePt(digits.slice(3));
  return raw.trim();
}

export function isValidPhonePt(masked: string): boolean {
  return masked.replace(/\D/g, "").length === 9;
}
