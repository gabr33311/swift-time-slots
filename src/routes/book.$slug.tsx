import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy public link: /book/<nome> now lives at /<nome>.
export const Route = createFileRoute("/book/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug", params: { slug: params.slug }, replace: true });
  },
  component: () => null,
});
