import { createFileRoute } from "@tanstack/react-router";
import { checkSlugAvailable } from "@/lib/booking.functions";

export const Route = createFileRoute("/api/public/slugtest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug") ?? "teste-abc";
        try {
          const res = await checkSlugAvailable({ data: { slug } });
          return new Response(JSON.stringify({ ok: true, res }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: String(e), stack: (e as Error)?.stack }),
            { headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
