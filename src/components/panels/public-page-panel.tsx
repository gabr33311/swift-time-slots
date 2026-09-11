import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useAutoSaveOnExit } from "@/hooks/use-autosave";

export function PublicPagePanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const edit = true;
  const [, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [showTeam, setShowTeam] = useState(true);
  const [showContacts, setShowContacts] = useState(true);

  function hydrate() {
    if (!business) return;
    setDescription(business.description ?? "");
    setShowTeam(business.show_team);
    setShowContacts(business.show_contacts);
  }
  useEffect(hydrate, [business]);

  const { data: services } = useQuery({
    queryKey: ["services-order", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, sort_order")
        .eq("business_id", business!.id)
        .order("sort_order")
        .order("created_at");
      return data ?? [];
    },
  });

  async function move(index: number, dir: -1 | 1) {
    const list = services ?? [];
    const target = list[index + dir];
    const current = list[index];
    if (!target || !current) return;
    await Promise.all([
      supabase.from("services").update({ sort_order: index + dir }).eq("id", current.id),
      supabase.from("services").update({ sort_order: index }).eq("id", target.id),
    ]);
    qc.invalidateQueries({ queryKey: ["services-order"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function save() {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        description: description.trim() || null,
        show_team: showTeam,
        show_contacts: showContacts,
      })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("pf.pub.saved"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const dirty =
    !!business &&
    (description !== (business.description ?? "") ||
      showTeam !== business.show_team ||
      showContacts !== business.show_contacts);

  useAutoSaveOnExit(dirty, save);

  return (
    <div className="space-y-4">
      <section className="surface space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{t("pf.pub.title")}</h2>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border">
          <ToggleRow
            title={t("pf.pub.showTeam")}
            description={t("pf.pub.showTeam.desc")}
            checked={showTeam}
            disabled={!edit}
            onChange={setShowTeam}
          />
          <ToggleRow
            title={t("pf.pub.showContacts")}
            description={t("pf.pub.contacts.desc")}
            checked={showContacts}
            disabled={!edit}
            onChange={setShowContacts}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold">{t("pf.pub.serviceOrder")}</Label>
          <ul className="space-y-2">
            {(services ?? []).map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("pf.common.up")}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("pf.common.down")}
                  disabled={i === (services?.length ?? 0) - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
