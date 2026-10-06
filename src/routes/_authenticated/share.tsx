import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { SharePanel } from "@/components/panels/share-panel";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/share")({
  head: () => ({
    meta: [
      { title: "Partilhar — SYCRAS" },
      {
        name: "description",
        content: "Link público, código QR e personalização da página de marcações.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Partilhar — SYCRAS" },
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
      <div className="mx-auto flex max-w-xl items-center justify-center min-h-[calc(100dvh-15rem)] lg:min-h-[calc(100dvh-11rem)]">
        <SharePanel />
      </div>
    </AppShell>
  );
}
