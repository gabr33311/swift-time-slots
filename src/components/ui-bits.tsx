import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefs } from "@/lib/prefs";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm font-normal text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
          {icon}
        </div>
      )}
      <p className="font-display text-base font-bold">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm font-normal leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground ring-warning/25",
  confirmed: "bg-success/12 text-success ring-success/25",
  completed: "bg-primary/10 text-primary ring-primary/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/20",
  no_show: "bg-destructive/10 text-destructive ring-destructive/20",
  expired: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground ring-border",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  to,
  search,
  icon,
  dimmed = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  search?: Record<string, unknown>;
  icon?: ReactNode;
  /** Secondary/quieter styling for empty (zero) values. */
  dimmed?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl",
              dimmed ? "bg-muted text-muted-foreground" : "bg-accent text-primary",
            )}
          >
            {icon}
          </span>
        )}
        <p className="min-w-0 flex-1 whitespace-normal break-words text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "font-display mt-3 text-[30px] font-bold leading-none tabular-nums tracking-tight",
          dimmed && "text-muted-foreground/60",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs font-normal text-muted-foreground">{hint}</p>}
    </>
  );
  const base = cn("surface p-5", dimmed && "bg-muted/40 shadow-none");
  if (to) {
    return (
      <Link
        to={to as never}
        search={search as never}
        className={cn(
          base,
          "block transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.985]",
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = usePrefs();
  return (
    <div className="surface p-6 text-center">
      <p className="text-sm font-bold">{t("ui.error.title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ?? t("ui.error.default")}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("ui.error.retry")}
        </button>
      )}
    </div>
  );
}
