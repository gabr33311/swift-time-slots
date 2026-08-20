import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Relatórios — Schedivo" },
      { name: "description", content: "Receita, ocupação e serviços mais procurados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <AppShell>
      <PageHeader title="Relatórios" subtitle="Os últimos 30 dias do teu negócio." />
      <AnalyticsPanel />
    </AppShell>
  );
}
