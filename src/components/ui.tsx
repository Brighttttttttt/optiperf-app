import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "./Icons";
import { rpeBand, RPE_CHIP, STATUS_CHIP } from "@/lib/rpe";
import { STATUS_LABELS, type FitnessStatus } from "@/lib/metrics";
import { PLANNING_STATE_LABEL, type PlanningState } from "@/lib/planning";

/** Entête de page : surtitre condensé + grand titre, retour optionnel. */
export function PageHeader({
  eyebrow,
  title,
  backHref,
  action,
}: {
  eyebrow: string;
  title: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="px-5 pt-6 pb-4 flex items-end justify-between gap-3">
      <div className="flex items-start gap-1.5 min-w-0">
        {backHref && (
          <Link
            href={backHref as never}
            aria-label="Retour"
            className="-ml-2 mt-1.5 p-1.5 rounded-full text-ink-soft hover:bg-line/60"
          >
            <IconChevronLeft className="size-6" />
          </Link>
        )}
        <div className="min-w-0">
          <p className="font-display uppercase tracking-[0.18em] text-[13px] font-semibold text-pine">
            {eyebrow}
          </p>
          <h1 className="font-display text-[34px] leading-9 font-semibold uppercase tracking-wide truncate">
            {title}
          </h1>
        </div>
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-line rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Pastille RPE : la rampe d'effort, partout où un RPE apparaît. */
export function RpeDot({ rpe }: { rpe: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center size-7 rounded-full text-card text-[13px] font-semibold ${
        rpeBand(rpe) === "low"
          ? "bg-rpe-low"
          : rpeBand(rpe) === "mid"
            ? "bg-rpe-mid"
            : rpeBand(rpe) === "high"
              ? "bg-rpe-high"
              : "bg-rpe-max"
      }`}
      title={`RPE ${rpe}/10`}
    >
      {rpe}
    </span>
  );
}

export function RpeChip({ rpe }: { rpe: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold ${RPE_CHIP[rpeBand(rpe)]}`}
    >
      RPE {rpe}
    </span>
  );
}

export function StatusBadge({ status }: { status: FitnessStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${STATUS_CHIP[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * État d'une séance dans un planning (fait / manquée / à rattraper / à venir).
 *
 * Quatre teintes distinctes plutôt que la rampe RPE, qui porte un autre sens
 * (l'effort ressenti) : ici c'est l'avancement qui se lit. « À rattraper »
 * emprunte l'accent d'alerte, seul des quatre à appeler une action.
 */
const PLANNING_STATE_CHIP: Record<PlanningState, string> = {
  fait: "bg-pine-soft text-pine",
  manquee: "bg-rpe-max-soft text-rpe-max",
  "a-rattraper": "bg-rpe-high-soft text-rpe-high",
  "a-venir": "bg-surface text-ink-soft",
};

export function PlanningStateBadge({ state }: { state: PlanningState }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${PLANNING_STATE_CHIP[state]}`}
    >
      {PLANNING_STATE_LABEL[state]}
    </span>
  );
}

/** Tuile de statistique : gros chiffre condensé, petit libellé. */
export function StatTile({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="font-display text-[26px] leading-7 font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-[12px] text-ink-soft truncate">{label}</p>
    </div>
  );
}
