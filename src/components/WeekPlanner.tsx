"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlus } from "./Icons";
import { RpeDot } from "./ui";
import { addDays, formatDuration, toISODate } from "@/lib/dates";
import { startOfWeek, weekDays, weekLabel } from "@/lib/planning";
import { rpeBand, RPE_BG } from "@/lib/rpe";
import { sessionTypeLabel, type TrainingSession } from "@/lib/types";
import { btnGhost, btnPrimary } from "@/lib/styles";

/**
 * Vue semaine : la grille donne la forme de la semaine d'un coup d'œil
 * (jours vides, enchaînement, intensités), le détail s'ouvre en dessous.
 * La navigation reste côté client — les séances des semaines voisines
 * sont déjà chargées.
 */
export function WeekPlanner({
  athleteId,
  sessions,
}: {
  athleteId: string;
  sessions: TrainingSession[];
}) {
  const today = useMemo(() => new Date(), []);
  const [monday, setMonday] = useState(() => startOfWeek(today));
  const [selected, setSelected] = useState<string | null>(toISODate(today));

  const days = useMemo(() => weekDays(monday, today), [monday, today]);
  const byDay = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [sessions]);

  const selectedSessions = selected ? (byDay.get(selected) ?? []) : [];
  const isCurrentWeek = toISODate(monday) === toISODate(startOfWeek(today));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          aria-label="Semaine précédente"
          onClick={() => setMonday(addDays(monday, -7))}
          className="p-1.5 -ml-1.5 rounded-full text-ink-soft hover:bg-line/60"
        >
          <IconChevronLeft className="size-5" />
        </button>
        <p className="text-[13px] font-semibold text-ink-soft text-center first-letter:uppercase">
          {isCurrentWeek ? "Cette semaine" : weekLabel(monday)}
        </p>
        <button
          type="button"
          aria-label="Semaine suivante"
          onClick={() => setMonday(addDays(monday, 7))}
          className="p-1.5 -mr-1.5 rounded-full text-ink-soft hover:bg-line/60"
        >
          <IconChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const daySessions = byDay.get(day.iso) ?? [];
          const isSelected = selected === day.iso;
          return (
            <button
              key={day.iso}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${day.label} ${day.dayOfMonth}, ${daySessions.length} séance(s)`}
              onClick={() => setSelected(day.iso)}
              className={`rounded-lg border py-1.5 transition-colors ${
                isSelected
                  ? "border-pine bg-pine-soft"
                  : day.isToday
                    ? "border-pine/40 bg-card"
                    : "border-line bg-card"
              }`}
            >
              <span
                className={`block text-[10px] uppercase ${day.isPast ? "text-ink-soft/60" : "text-ink-soft"}`}
              >
                {day.label}
              </span>
              <span
                className={`block font-display text-[15px] font-semibold tabular-nums ${
                  day.isPast ? "text-ink-soft" : "text-ink"
                }`}
              >
                {day.dayOfMonth}
              </span>
              {/* Une pastille par séance : couleur de l'effort si elle est
                  faite, contour si elle est à venir, barrée si manquée. */}
              <span className="mt-1 flex items-center justify-center gap-0.5 h-2">
                {daySessions.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className={`size-1.5 rounded-full ${
                      s.status === "completed" && s.rpe
                        ? RPE_BG[rpeBand(s.rpe)]
                        : s.status === "missed"
                          ? "bg-rpe-max/40"
                          : "border border-pine"
                    }`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 space-y-2">
          {selectedSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-4 text-center">
              <p className="text-[13px] text-ink-soft">
                Rien de prévu ce jour-là.
              </p>
              <Link
                href={`/planifier?athlete=${athleteId}&date=${selected}`}
                className={`${btnGhost} mt-2.5`}
              >
                <IconPlus className="size-4" />
                Planifier ce jour
              </Link>
            </div>
          ) : (
            selectedSessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-line bg-card px-3.5 py-2.5 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{s.title}</p>
                  <p className="text-[13px] text-ink-soft">
                    {sessionTypeLabel(s.type)}
                    {(() => {
                      const d = s.duration_actual_min ?? s.duration_planned_min;
                      return d ? ` · ${formatDuration(d)}` : "";
                    })()}
                    {s.status === "missed" ? " · manquée" : ""}
                    {s.coach_id === null ? " · libre" : ""}
                  </p>
                  {s.athlete_comment && (
                    <p className="mt-1 text-[13px] text-ink-soft italic">
                      « {s.athlete_comment} »
                    </p>
                  )}
                </div>
                {s.status === "completed" && s.rpe !== null ? (
                  <RpeDot rpe={s.rpe} />
                ) : s.status === "planned" ? (
                  <Link
                    href={`/seances/${s.id}`}
                    className="shrink-0 text-[13px] font-semibold text-pine"
                  >
                    Modifier
                  </Link>
                ) : null}
              </div>
            ))
          )}

          {selectedSessions.length > 0 && (
            <Link
              href={`/planifier?athlete=${athleteId}&date=${selected}`}
              className={`${btnPrimary} w-full py-2.5 text-[14px]`}
            >
              <IconPlus className="size-4" />
              Ajouter une séance ce jour
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
