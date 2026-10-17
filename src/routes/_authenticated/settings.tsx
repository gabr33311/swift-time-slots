import { createFileRoute } from "@tanstack/react-router";
import { SubPage } from "@/components/sub-page";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { AccountPanel } from "@/components/panels/account-panel";
import { usePrefs } from "@/lib/prefs";

// Account settings and the plan, opened from the gear on Manage.
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Definições — SYCRAS" },
      { name: "description", content: "Subscrição, cor da app, tema, idioma e sessão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = usePrefs();
  return (
    <SubPage title={t("pf.s.settings")} back="/profile">
      <SettingsPanel />
      <AccountPanel />
    </SubPage>
  );
}
