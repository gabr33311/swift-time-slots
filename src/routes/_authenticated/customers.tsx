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
import { Users, Ban, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Clientes — Marca" },
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

      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Procurar por nome ou telemóvel"
        maxLength={60}
        className="mb-4 max-w-sm"
      />

      {isLoading ? (
        <LoadingRows />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={term ? "Sem resultados." : "Ainda sem clientes."}
          description={
            term
              ? "Tenta outro nome ou número."
              : "Cada marcação cria automaticamente a ficha do cliente."
          }
        />
      ) : (
        <ul className="space-y-2">
          {data!.map((c) => (
            <li key={c.id} className="surface flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.phone ?? c.email ?? "Sem contacto"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBlock(c.id, c.is_blocked)}
                aria-label={c.is_blocked ? "Desbloquear" : "Bloquear"}
              >
                {c.is_blocked ? (
                  <>
                    <ShieldCheck className="mr-1.5 size-4" /> Desbloquear
                  </>
                ) : (
                  <>
                    <Ban className="mr-1.5 size-4" /> Bloquear
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
