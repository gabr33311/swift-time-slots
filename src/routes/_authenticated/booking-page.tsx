import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/booking-page")({
  beforeLoad: () => {
    throw redirect({ to: "/share" });
  },
  component: () => null,
});
