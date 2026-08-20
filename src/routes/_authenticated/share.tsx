import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { SharePanel } from "@/components/panels/share-panel";
import { PublicPagePanel } from "@/components/panels/public-page-panel";

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
  return (
    <AppShell>
      <PageHeader
        title="Partilhar"
        subtitle="Tudo o que o cliente vê: link, código QR e personalização."
      />
      <SharePanel />
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Personalizar página</h2>
        <PublicPagePanel />
      </section>
    </AppShell>
  );
}
