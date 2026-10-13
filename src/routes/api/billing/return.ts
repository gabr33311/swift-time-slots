import { createFileRoute } from "@tanstack/react-router";

// After Stripe, back to the phone app (its in-app browser closes on sycras://).
export const Route = createFileRoute("/api/billing/return")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const status = new URL(request.url).searchParams.get("status") ?? "";
        const safe = ["success", "cancelled", "portal"].includes(status) ? status : "cancelled";
        return new Response(null, {
          status: 302,
          headers: { Location: `sycras://pro?checkout=${safe}` },
        });
      },
    },
  },
});
