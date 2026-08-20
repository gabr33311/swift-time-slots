import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { WEEKDAYS_PT, formatDateShort } from "@/lib/format";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({
    meta: [
      { title: "Horários — Schedivo" },
      { name: "description", content: "Define os horários de funcionamento e as folgas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AvailabilityPage,
});

type DayState = {
  enabled: boolean;
  start: string;
  end: string;
  lunch: boolean;
  lunchStart: string;
  lunchEnd: string;
};

const DEFAULT_DAY: DayState = {
  enabled: false,
  start: "09:00",
  end: "18:00",
  lunch: false,
  lunchStart: "13:00",
  lunchEnd: "14:00",
};

function AvailabilityPage() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [days, setDays] = useState<DayState[]>(
    Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY })),
  );
  const [busy, setBusy] = useState(false);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["availability", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const [{ data: hours }, { data: blocks }] = await Promise.all([
        supabase
          .from("working_hours")
          .select("id, weekday, start_time, end_time")
          .eq("business_id", business!.id)
          .is("staff_id", null)
          .order("weekday"),
        supabase
          .from("blocked_times")
          .select("id, starts_at, ends_at, reason")
          .eq("business_id", business!.id)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at"),
      ]);
      return { hours: hours ?? [], blocks: blocks ?? [] };
    },
  });

  useEffect(() => {
    if (!data) return;
    const next: DayState[] = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY }));
    const byDay: Record<number, { start: string; end: string }[]> = {};
    for (const h of data.hours) {
      (byDay[h.weekday] ??= []).push({
        start: h.start_time.slice(0, 5),
        end: h.end_time.slice(0, 5),
      });
    }
    for (const [weekday, ranges] of Object.entries(byDay)) {
      const i = Number(weekday);
      const sorted = ranges.sort((a, b) => a.start.localeCompare(b.start));
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      next[i] = {
        enabled: true,
        start: first.start,
        end: last.end,
        lunch: sorted.length > 1,
        lunchStart: sorted.length > 1 ? first.end : DEFAULT_DAY.lunchStart,
        lunchEnd: sorted.length > 1 ? last.start : DEFAULT_DAY.lunchEnd,
      };
    }
    setDays(next);
  }, [data]);

  async function saveHours() {
    if (!business) return;
    setBusy(true);
    try {
      await supabase
        .from("working_hours")
        .delete()
        .eq("business_id", business.id)
        .is("staff_id", null);
      const rows = days
        .map((d, weekday) => ({ ...d, weekday }))
        .filter((d) => d.enabled && d.start < d.end)
        .flatMap((d) => {
          const hasLunch =
            d.lunch && d.start < d.lunchStart && d.lunchStart < d.lunchEnd && d.lunchEnd < d.end;
          if (!hasLunch) {
            return [
              {
                business_id: business.id,
                weekday: d.weekday,
                start_time: d.start,
                end_time: d.end,
              },
            ];
          }
          return [
            {
              business_id: business.id,
              weekday: d.weekday,
              start_time: d.start,
              end_time: d.lunchStart,
            },
            {
              business_id: business.id,
              weekday: d.weekday,
              start_time: d.lunchEnd,
              end_time: d.end,
            },
          ];
        });
      if (rows.length) await supabase.from("working_hours").insert(rows);
      toast.success("Horários guardados.");
      qc.invalidateQueries({ queryKey: ["availability"] });
    } catch {
      toast.error("Não foi possível guardar os horários.");
    } finally {
      setBusy(false);
    }
  }

  async function addBlock() {
    if (!business) return;
    if (!blockFrom || !blockTo || new Date(blockFrom) >= new Date(blockTo)) {
      toast.error("Escolhe um intervalo válido.");
      return;
    }
    const { error } = await supabase.from("blocked_times").insert({
      business_id: business.id,
      starts_at: new Date(blockFrom).toISOString(),
      ends_at: new Date(blockTo).toISOString(),
      reason: reason.trim().slice(0, 120) || null,
    });
    if (error) {
      toast.error("Não foi possível criar a folga.");
      return;
    }
    setBlockFrom("");
    setBlockTo("");
    setReason("");
    toast.success("Folga adicionada.");
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  async function removeBlock(id: string) {
    await supabase.from("blocked_times").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  return (
    <AppShell>
      <PageHeader title="Horários" subtitle="Quando estás disponível para marcações." />

      {isLoading ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <section className="surface animate-enter p-5">
            <h2 className="text-base font-semibold">Horário semanal</h2>
            <div className="mt-4 space-y-3">
              {days.map((d, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Switch
                    checked={d.enabled}
                    onCheckedChange={(v) =>
                      setDays((prev) => prev.map((x, j) => (j === i ? { ...x, enabled: v } : x)))
                    }
                    aria-label={WEEKDAYS_PT[i]}
                  />
                  <span className="w-24 text-sm font-medium">{WEEKDAYS_PT[i]}</span>
                  <Input
                    type="time"
                    value={d.start}
                    disabled={!d.enabled}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={d.end}
                    disabled={!d.enabled}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
                </div>
                {d.enabled && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <Switch
                      checked={d.lunch}
                      onCheckedChange={(v) =>
                        setDays((prev) => prev.map((x, j) => (j === i ? { ...x, lunch: v } : x)))
                      }
                      aria-label={`Almoço ${WEEKDAYS_PT[i]}`}
                    />
                    <span className="w-24 text-sm font-medium">Almoço</span>
                    <Input
                      type="time"
                      value={d.lunchStart}
                      disabled={!d.lunch}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, lunchStart: e.target.value } : x)),
                        )
                      }
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={d.lunchEnd}
                      disabled={!d.lunch}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, lunchEnd: e.target.value } : x)),
                        )
                      }
                      className="w-32"
                    />
                  </div>
                )}
                </div>
              ))}
            </div>
            <Button className="mt-5" onClick={saveHours} disabled={busy}>
              Guardar horários
            </Button>
          </section>

          <section className="surface mt-6 p-5">
            <h2 className="text-base font-semibold">Folgas e ausências</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bloqueia períodos em que não recebes marcações.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bf">Início</Label>
                <Input
                  id="bf"
                  type="datetime-local"
                  value={blockFrom}
                  onChange={(e) => setBlockFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bt">Fim</Label>
                <Input
                  id="bt"
                  type="datetime-local"
                  value={blockTo}
                  onChange={(e) => setBlockTo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="br">Motivo</Label>
                <Input
                  id="br"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={120}
                  placeholder="Férias"
                />
              </div>
            </div>
            <Button variant="outline" className="mt-4" onClick={addBlock}>
              Adicionar folga
            </Button>

            {(data?.blocks.length ?? 0) > 0 && (
              <ul className="mt-5 space-y-2">
                {data!.blocks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="flex-1">
                      {formatDateShort(b.starts_at, business!.timezone)} —{" "}
                      {formatDateShort(b.ends_at, business!.timezone)}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover folga"
                      onClick={() => removeBlock(b.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
