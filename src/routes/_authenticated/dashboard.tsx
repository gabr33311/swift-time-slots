import { createFileRoute, redirect } from "@tanstack/react-router";

/** The dashboard merged into the calendar — keep the old URL working. */
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/calendar" });
  },
  head: () => ({
    meta: [
      { title: "Agenda — SYCRAS" },
      { name: "description", content: "O resumo do teu dia: marcações, receita prevista e clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
