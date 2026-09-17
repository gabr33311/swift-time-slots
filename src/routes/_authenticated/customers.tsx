import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyBusiness } from "@/hooks/use-business";
import { initials } from "@/lib/format";
import { Users, Ban, ShieldCheck, Search, Pencil, Plus } from "lucide-react";
import {
  EditCustomerDialog,
  type EditableCustomer,
} from "@/components/edit-customer-dialog";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Clientes — Schedivo" },
      { name: "description", content: "A tua base de clientes, com histórico e contactos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"all" | "cancelled" | "blocked">("all");
  const [editing, setEditing] = useState<EditableCustomer | null>(null);
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: cancelledMap } = useQuery({
    queryKey: ["customers-cancelled", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("business_id", business!.id)
        .eq("status", "cancelled")
        .not("customer_id", "is", null)
        .limit(1000);
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.customer_id) map[row.customer_id] = (map[row.customer_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["customers", business?.id, term],
    enabled: !!business,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, name, phone, email, notes, is_blocked, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const clean = term.trim().replace(/[%,()]/g, "");
      if (clean) q = q.or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const rows = (data ?? []).filter((c) =>
    tab === "cancelled"
      ? (cancelledMap?.[c.id] ?? 0) > 0
      : tab === "blocked"
        ? c.is_blocked
        : true,
  );

  async function toggleBlock(id: string, blocked: boolean) {
    const { error } = await supabase.from("customers").update({ is_blocked: !blocked }).eq("id", id);
    if (error) {
      toast.error(t("cust.toast.updateError"));
      return;
    }
    toast.success(blocked ? t("cust.toast.unblocked") : t("cust.toast.blocked"));
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <AppShell>
      <PageHeader title={t("cust.title")} subtitle={t("cust.subtitle")} />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("cust.search.placeholder")}
          maxLength={60}
          className="pl-10"
        />
      </div>

      <div className="mb-4 flex items-center gap-1.5 rounded-full bg-muted p-1">
        {(
          [
            ["all", "Todos"],
            ["cancelled", "Cancelaram"],
            ["blocked", "Bloqueados"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "h-9 flex-1 rounded-full text-[13px] font-bold transition-all duration-200",
              tab === value
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>




      {isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={
            tab === "cancelled"
              ? t("cust.empty.cancelled")
              : tab === "blocked"
                ? t("cust.empty.blocked")
                : term
                  ? t("cust.empty.noResults")
                  : t("cust.empty.none")
          }
          description={
            term
              ? t("cust.empty.desc.search")
              : t("cust.empty.desc.default")
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <li key={c.id} className="surface surface-hover flex items-center gap-3.5 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold leading-snug">{c.name}</p>
                <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
                  {c.phone ?? c.email ?? t("cust.noContact")}
                  {(cancelledMap?.[c.id] ?? 0) > 0 && (
                    <span className="ml-2 font-semibold text-destructive">
                      {cancelledMap![c.id]} {cancelledMap![c.id]! > 1 ? t("cust.cancellations") : t("cust.cancellation")}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("cust.edit")} ${c.name}`}
                className="size-9 shrink-0 text-muted-foreground"
                onClick={() => setEditing(c)}
              >
                <Pencil className="size-4" />
              </Button>
              {c.is_blocked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-success hover:bg-success/10 hover:text-success"
                  onClick={() => toggleBlock(c.id, true)}
                >
                  <ShieldCheck className="size-4" />
                  <span className="hidden sm:inline">{t("cust.unblock")}</span>
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("cust.block")} ${c.name}`}
                      className="size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Ban className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("cust.blockTitle")} {c.name}{t("cust.blockConfirmSuffix")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("cust.blockDesc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cust.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => toggleBlock(c.id, false)}>
                        {t("cust.block")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
          <li className="py-6 text-center text-sm font-medium text-muted-foreground">
            {t("cust.noMore")}
          </li>
        </ul>
      )}

      <Button
        size="icon"
        aria-label={t("cust.new")}
        onClick={() => setCreating(true)}
        className="fixed bottom-24 right-5 z-40 size-14 rounded-full shadow-lift sm:bottom-8"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Button>

      <EditCustomerDialog
        key={editing?.id ?? (creating ? "new" : "idle")}
        customer={editing}
        businessId={business?.id}
        open={!!editing || creating}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
      />
    </AppShell>
  );
}
