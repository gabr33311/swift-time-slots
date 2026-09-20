import { MessageCircle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { SharePanel } from "@/components/panels/share-panel";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";

const PUBLIC_ORIGIN = "https://bookflow.pt";

function publicOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  const host = window.location.hostname;
  const isPreview = host.includes("id-preview") || host === "localhost" || host.endsWith(".local");
  return isPreview ? PUBLIC_ORIGIN : window.location.origin;
}

/** Apple-Wallet style pass that slides up from anywhere in the app. */
export function ShareSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const url = business ? `${publicOrigin()}/book/${business.slug}` : "";

  function whatsapp() {
    if (!url) return;
    const text = encodeURIComponent(`${t("dock.whatsappMsg")} ${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <DrawerHeader className="pb-1 text-center">
          <DrawerTitle>{t("dock.pass")}</DrawerTitle>
          <DrawerDescription>{business?.name ?? ""}</DrawerDescription>
        </DrawerHeader>
        <div className="mx-auto w-full max-w-sm px-5 pb-2">
          <SharePanel compact />
          <button
            type="button"
            onClick={whatsapp}
            className="action-gradient mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold"
          >
            <MessageCircle className="size-[18px]" strokeWidth={2.6} />
            {t("dock.whatsapp")}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
