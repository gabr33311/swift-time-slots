import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { SharePanel } from "@/components/panels/share-panel";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/share")({
  head: () => ({
    meta: [
      { title: "Partilhar — Schedivo" },
      {
        name: "description",
        content: "Link público, código QR e personalização da página de marcações.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Partilhar — Schedivo" },
      {
        property: "og:description",
        content: "Link público, código QR e personalização da página de marcações.",
      },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { t } = usePrefs();
  return (
    <AppShell>
      <PageHeader
        title={t("share.title")}
        subtitle={t("share.subtitle")}
      />
      <SharePanel />
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">{t("share.customize")}</h2>
        <PublicPagePanel />
      </section>
    </AppShell>
  );
}
