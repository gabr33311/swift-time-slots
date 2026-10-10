import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const PUBLIC_ORIGIN = "https://sycras.com";

function publicOrigin(): string {
  return PUBLIC_ORIGIN;
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
  const url = business ? `${publicOrigin()}/${business.slug}` : "";

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
          <Button type="button" size="lg" onClick={whatsapp} className="mt-6 w-full">
            <MessageCircle strokeWidth={2.6} />
            {t("dock.whatsapp")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
