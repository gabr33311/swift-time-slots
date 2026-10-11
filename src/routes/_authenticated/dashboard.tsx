import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Old dashboard URL: the "Today" screen replaced it. */
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    // Unfinished signup: no business yet → resume the setup, never the main panel.
    const { data } = await supabase.from("business_members").select("business_id").limit(1);
    if (!data || data.length === 0) throw redirect({ to: "/onboarding" });
    throw redirect({ to: "/today" });
  },
  head: () => ({
    meta: [
      { title: "Agenda — SYCRAS" },
      {
        name: "description",
        content: "O resumo do teu dia: marcações, receita prevista e clientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
