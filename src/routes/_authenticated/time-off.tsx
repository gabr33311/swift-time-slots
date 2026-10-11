import { createFileRoute } from "@tanstack/react-router";
import { SubPage } from "@/components/sub-page";
import { AvailabilityPanel } from "@/components/panels/availability-panel";
import { usePrefs } from "@/lib/prefs";

// Days off and holidays, opened from the calendar (and from the weekly hours).
export const Route = createFileRoute("/_authenticated/time-off")({
  head: () => ({
    meta: [
      { title: "Folgas e férias — SYCRAS" },
      { name: "description", content: "Períodos em que não recebes marcações." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimeOffPage,
});

function TimeOffPage() {
  const { t } = usePrefs();
  return (
    <SubPage title={t("pf.s.timeoff")} back="/calendar">
      <AvailabilityPanel view="off" />
    </SubPage>
  );
}
