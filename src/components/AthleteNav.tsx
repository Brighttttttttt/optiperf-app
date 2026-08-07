"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Fiche" },
  { segment: "planning", label: "Planning" },
  { segment: "historique", label: "Historique" },
  { segment: "messagerie", label: "Messagerie" },
] as const;

/**
 * Navigation partagée par les quatre vues d'un même athlète : passer d'un
 * onglet à l'autre, ou d'un athlète à l'autre sans repasser par le tableau
 * de bord. Posée une fois dans le layout, pas reconstruite à chaque onglet.
 */
export function AthleteNav({
  athleteId,
  roster,
}: {
  athleteId: string;
  roster: { id: string; full_name: string }[];
}) {
  const pathname = usePathname();
  const base = `/athletes/${athleteId}`;
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const activeSegment = suffix.replace(/^\//, "").split("/")[0] ?? "";

  return (
    <div>
      {roster.length > 1 && (
        <div className="-mx-5 px-5 overflow-x-auto">
          <div className="flex gap-2 w-max pb-3">
            {roster.map((a) => {
              const active = a.id === athleteId;
              return (
                <Link
                  key={a.id}
                  href={`/athletes/${a.id}${suffix}` as never}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-[14px] font-semibold transition-colors ${
                    active
                      ? "border-pine bg-pine-soft text-ink"
                      : "border-line bg-card text-ink-soft hover:border-pine/40 hover:text-ink"
                  }`}
                >
                  {a.full_name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav aria-label="Sections de la fiche athlète" className="flex border-b border-line">
        {TABS.map(({ segment, label }) => {
          const href = `${base}${segment ? `/${segment}` : ""}`;
          const active = activeSegment === segment;
          return (
            <Link
              key={segment}
              href={href as never}
              aria-current={active ? "page" : undefined}
              className={`flex-1 text-center py-2.5 text-[13px] font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors ${
                active ? "border-pine text-pine" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
