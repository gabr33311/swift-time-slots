import { createFileRoute } from "@tanstack/react-router";

// The native phone app checks here whether a business link is free (it can't
// call server functions). Same answer as checkSlugAvailable.
export const Route = createFileRoute("/api/slug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clean = (new URL(request.url).searchParams.get("slug") ?? "").trim().toLowerCase();
        const { isReservedSlug } = await import("@/lib/reserved-slugs");
        if (!/^[a-z0-9-]{3,48}$/.test(clean) || isReservedSlug(clean)) {
          return Response.json({ available: false, invalid: true });
        }
        const { slugTaken } = await import("@/lib/booking.server");
        return Response.json({ available: !(await slugTaken(clean)), invalid: false });
      },
    },
  },
});
