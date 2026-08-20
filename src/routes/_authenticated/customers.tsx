import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyBusiness } from "@/hooks/use-business";
import { initials } from "@/lib/format";
import { Users, Ban, ShieldCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"all" | "cancelled" | "blocked">("all");

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
      toast.error("Não foi possível actualizar o cliente.");
      return;
    }
    toast.success(blocked ? "Cliente desbloqueado." : "Cliente bloqueado.");
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <AppShell>
      <PageHeader title="Clientes" subtitle="Quem já passou pelo teu negócio." />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Procurar por nome ou telemóvel"
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
              ? "Ninguém cancelou por agora."
              : tab === "blocked"
                ? "Sem clientes bloqueados."
                : term
                  ? "Sem resultados."
                  : "Ainda sem clientes."
          }
          description={
            term
              ? "Tenta outro nome ou número."
              : "Cada marcação cria automaticamente a ficha do cliente."
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
                  {c.phone ?? c.email ?? "Sem contacto"}
                  {(cancelledMap?.[c.id] ?? 0) > 0 && (
                    <span className="ml-2 font-semibold text-destructive">
                      {cancelledMap![c.id]} cancelamento{cancelledMap![c.id]! > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              {c.is_blocked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-success hover:bg-success/10 hover:text-success"
                  onClick={() => toggleBlock(c.id, true)}
                >
                  <ShieldCheck className="size-4" />
                  <span className="hidden sm:inline">Desbloquear</span>
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Bloquear ${c.name}`}
                      className="size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Ban className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Bloquear {c.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Este cliente deixa de poder fazer marcações na tua página. Podes
                        desbloquear a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => toggleBlock(c.id, false)}>
                        Bloquear
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
          <li className="py-6 text-center text-sm font-medium text-muted-foreground">
            Não há mais clientes a mostrar.
          </li>
        </ul>
      )}
    </AppShell>
  );
}
