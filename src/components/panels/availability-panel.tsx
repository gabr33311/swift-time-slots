import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LoadingRows } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { PublicPagePanel } from "@/components/panels/public-page-panel";
import { weekdays, formatDateShort } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { Trash2, Pencil, Save, X } from "lucide-react";

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

function fromRows(hours: { weekday: number; start_time: string; end_time: string }[]) {
  const next: DayState[] = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY }));
  const byDay: Record<number, { start: string; end: string }[]> = {};
  for (const h of hours) {
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
  return next;
}

export function AvailabilityPanel() {
  const { business } = useMyBusiness();
  const { t, lang } = usePrefs();
  const dayNames = weekdays(lang);
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
    setDays(fromRows(data.hours));
  }, [data]);

  const dirty = !!data && JSON.stringify(days) !== JSON.stringify(fromRows(data.hours));

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
      toast.success(t("pf.av.saved"));
      qc.invalidateQueries({ queryKey: ["availability"] });
    } catch {
      toast.error(t("pf.av.err.save"));
    } finally {
      setBusy(false);
    }
  }

  async function addBlock() {
    if (!business) return;
    if (!blockFrom || !blockTo || new Date(blockFrom) >= new Date(blockTo)) {
      toast.error(t("pf.av.err.range"));
      return;
    }
    const { error } = await supabase.from("blocked_times").insert({
      business_id: business.id,
      starts_at: new Date(blockFrom).toISOString(),
      ends_at: new Date(blockTo).toISOString(),
      reason: reason.trim().slice(0, 120) || null,
    });
    if (error) {
      toast.error(t("pf.av.err.block"));
      return;
    }
    setBlockFrom("");
    setBlockTo("");
    setReason("");
    toast.success(t("pf.av.blockAdded"));
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  async function removeBlock(id: string) {
    await supabase.from("blocked_times").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  if (isLoading) return <LoadingRows rows={4} />;

  const locked = false;

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t("pf.av.weekly")}</h2>
        </div>

        <div className="mt-4 space-y-3">
          {days.map((d, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={d.enabled}
                  disabled={locked}
                  onCheckedChange={(v) =>
                    setDays((prev) => prev.map((x, j) => (j === i ? { ...x, enabled: v } : x)))
                  }
                  aria-label={dayNames[i]}
                />
                <span className="w-24 text-sm font-semibold">{dayNames[i]}</span>
                <Input
                  type="time"
                  value={d.start}
                  disabled={locked || !d.enabled}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                    )
                  }
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{t("pf.av.to")}</span>
                <Input
                  type="time"
                  value={d.end}
                  disabled={locked || !d.enabled}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                    )
                  }
                  className="w-32"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <Switch
                  checked={d.lunch}
                  disabled={locked || !d.enabled}
                  onCheckedChange={(v) =>
                    setDays((prev) => prev.map((x, j) => (j === i ? { ...x, lunch: v } : x)))
                  }
                  aria-label={`${t("pf.av.lunch")} ${dayNames[i]}`}
                />
                <span className="w-32 text-sm font-bold">{t("pf.av.lunch")}</span>

                  <Input
                    type="time"
                    value={d.lunchStart}
                    disabled={locked || !d.lunch}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, lunchStart: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">{t("pf.av.to")}</span>
                  <Input
                    type="time"
                    value={d.lunchEnd}
                    disabled={locked || !d.lunch}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, lunchEnd: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-base font-semibold">{t("pf.av.blocks")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pf.av.blocks.desc")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bf" className="font-semibold">
              {t("pf.av.start")}
            </Label>
            <Input
              id="bf"
              type="datetime-local"
              value={blockFrom}
              onChange={(e) => setBlockFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bt" className="font-semibold">
              {t("pf.av.end")}
            </Label>
            <Input
              id="bt"
              type="datetime-local"
              value={blockTo}
              onChange={(e) => setBlockTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br" className="font-semibold">
              {t("pf.av.reason")}
            </Label>
            <Input
              id="br"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder={t("pf.av.reason.placeholder")}
            />
          </div>
        </div>
        <Button variant="outline" className="mt-4" onClick={addBlock}>
          {t("pf.av.addBlock")}
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
                  aria-label={t("pf.av.removeBlock")}
                  onClick={() => removeBlock(b.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BookingRules />

      <PublicPagePanel />
    </div>
  );
}

function BookingRules() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [cancellation, setCancellation] = useState("24");
  const [interval, setIntervalMin] = useState("15");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!business) return;
    setCancellation(String(business.cancellation_hours));
    setIntervalMin(String(business.slot_interval_minutes));
  }, [business]);

  async function save() {
    if (!business) return;
    const ch = Number(cancellation);
    const si = Number(interval);
    if (!Number.isFinite(ch) || ch < 0 || ch > 168 || !Number.isFinite(si) || si < 5 || si > 120) {
      toast.error(t("pf.common.checkData"));
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({ cancellation_hours: ch, slot_interval_minutes: si })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("pf.common.saved"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  return (
    <section className="surface space-y-4 p-5">
      <h2 className="text-base font-semibold">{t("pf.av.rules")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="avch" className="font-semibold">
            {t("pf.biz.cancellation")}
          </Label>
          <Input
            id="avch"
            inputMode="numeric"
            value={cancellation}
            onChange={(e) => setCancellation(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="avsi" className="font-semibold">
            {t("pf.biz.slotInterval")}
          </Label>
          <Input
            id="avsi"
            inputMode="numeric"
            value={interval}
            onChange={(e) => setIntervalMin(e.target.value)}
          />
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={busy}>
        <Save className="mr-2 size-4" /> {t("pf.common.save")}
      </Button>
    </section>
  );
}
