import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/booking-page")({
  head: () => ({
    meta: [
      { title: "Página pública — Schedivo" },
      { name: "description", content: "Partilha o teu link de marcações com os clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPageSettings,
});

function BookingPageSettings() {
  return (
    <AppShell>
      <PageHeader title="Página de marcações" subtitle="O link que dás aos teus clientes." />
      <SharePanel />
      <div className="mt-6">
        <SettingsPanel />
      </div>
    </AppShell>
  );
}
