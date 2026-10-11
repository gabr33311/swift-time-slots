import { createFileRoute } from "@tanstack/react-router";
import { SubPage } from "@/components/sub-page";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { usePrefs } from "@/lib/prefs";

// Opened from the "This week" card on Today.
export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Estatísticas — SYCRAS" },
      { name: "description", content: "Receita, ocupação e serviços mais procurados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { t } = usePrefs();
  return (
    <SubPage title={t("pf.s.analytics")} back="/today">
      <AnalyticsPanel />
    </SubPage>
  );
}
