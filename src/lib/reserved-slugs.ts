// Caminhos da app que nunca podem ser usados como link público de um negócio.
export const RESERVED_SLUGS = [
  "auth", "login", "logout", "register", "reset-password", "book", "booking",
  "api", "app", "admin", "dashboard", "calendar", "customers", "share",
  "profile", "onboarding", "analytics", "appointments", "pendentes", "waitlist",
  "booking-page", "minhas-marcacoes", "settings", "support", "about", "pricing",
  "terms", "privacy", "assets", "static", "public", "www",
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
