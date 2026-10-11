import { createFileRoute, redirect } from "@tanstack/react-router";

/** Sharing now lives in Manage → Share (and on the Today screen); keep old links working. */
export const Route = createFileRoute("/_authenticated/share")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", search: { section: "share" } });
  },
  component: () => null,
});
