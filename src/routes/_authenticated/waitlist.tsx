import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/waitlist")({
  head: () => ({
    meta: [
      { title: "Lista de espera — SYCRAS" },
      { name: "description", content: "Clientes à espera de vaga para serem contactados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WaitlistPage,
});

function WaitlistPage() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("waitlist_entries")
        .select("id, customer_name, customer_phone, preference, date_from, date_to, status, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("waitlist_entries").update({ status }).eq("id", id);
    if (error) {
      toast.error(t("cust.wait.toast.updateError"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["waitlist"] });
  }

  return (
    <AppShell>
      <PageHeader title={t("cust.wait.title")} subtitle={t("cust.wait.subtitle")} />

      {isLoading ? (
        <LoadingRows />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-6" />}
          title={t("cust.wait.empty.title")}
          description={t("cust.wait.empty.desc")}
        />
      ) : (
        <ul className="space-y-2">
          {data!.map((w) => (
            <li key={w.id} className="surface flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.customer_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {w.customer_phone ?? t("cust.wait.noContact")}
                  {w.preference ? ` · ${w.preference}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{w.status}</span>
              <Button variant="outline" size="sm" onClick={() => setStatus(w.id, "contacted")}>
                {t("cust.wait.contacted")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStatus(w.id, "closed")}>
                {t("cust.wait.close")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
