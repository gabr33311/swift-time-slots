import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";

/** A page reached from a button elsewhere: its own title and a way back there. */
export function SubPage({
  title,
  back,
  children,
}: {
  title: string;
  back: "/today" | "/calendar" | "/profile";
  children: ReactNode;
}) {
  const { t } = usePrefs();
  return (
    <AppShell>
      <PageHeader
        title={title}
        leading={
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={t("pf.back")}
            className="text-foreground"
          >
            <Link to={back}>
              <ArrowLeft className="size-5" strokeWidth={2.5} />
            </Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </AppShell>
  );
}
