import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Relatórios — SYCRAS" },
      { name: "description", content: "Receita, ocupação e serviços mais procurados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { t } = usePrefs();
  return (
    <AppShell>
      <PageHeader title={t("ui.analytics.title")} subtitle={t("ui.analytics.subtitle")} />
      <AnalyticsPanel />
    </AppShell>
  );
}
