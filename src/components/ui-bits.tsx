import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

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
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
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
    <div className="surface flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {icon}
        </div>
      )}
      <p className="text-base font-bold">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  search?: Record<string, unknown>;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            {icon}
          </span>
        )}
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-muted-foreground">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to as never}
        search={search as never}
        className="surface block p-4 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="surface p-4">{inner}</div>;
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
  return (
    <div className="surface p-6 text-center">
      <p className="text-sm font-bold">Não foi possível carregar</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ?? "Verifica a ligação e tenta novamente."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
