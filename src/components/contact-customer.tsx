import { MessageCircle, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizePhonePt } from "@/lib/phone";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** "Contactar" button: quick WhatsApp chat or phone call to the customer. */
export function ContactCustomer({
  phone,
  compact,
  className,
}: {
  phone: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const { t } = usePrefs();
  if (!phone) return null;
  const normalized = normalizePhonePt(phone) || phone;
  const digits = normalized.replace(/\D/g, "");
  const label = t("ui.contact");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "tap-target relative flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card font-bold text-foreground transition-colors hover:bg-muted",
            compact ? "size-8" : "h-9 px-3 text-xs sm:text-sm",
            className,
          )}
        >
          <Phone className="size-4" strokeWidth={2.6} />
          {!compact && <span className="hidden min-[380px]:inline">{label}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 p-1.5">
        <DropdownMenuItem asChild className="py-2.5 font-bold">
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1 size-4" /> WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="py-2.5 font-bold">
          <a href={`tel:${normalized.replace(/[^\d+]/g, "")}`}>
            <Phone className="mr-1 size-4" /> {t("ui.call")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
