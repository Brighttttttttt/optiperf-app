"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlus } from "./Icons";
import { PlanningStateBadge, RpeDot } from "./ui";
import { WorkoutBlocksList } from "./WorkoutBlocksList";
import { ExercisesList } from "./ExercisesList";
import { addDays, formatDuration, toISODate } from "@/lib/dates";
import { planningState, startOfWeek, weekDays, weekLabel } from "@/lib/planning";
import { rpeBand, RPE_BG } from "@/lib/rpe";
import {
  sessionTypeLabel,
  type Exercise,
  type ExerciseLog,
  type TrainingSession,
  type WorkoutBlock,
} from "@/lib/types";
import { btnGhost, btnPrimary } from "@/lib/styles";

/**
 * Vue semaine : la grille donne la forme de la semaine d'un coup d'œil
 * (jours vides, enchaînement, intensités), le détail s'ouvre en dessous.
 * La navigation reste côté client — les séances des semaines voisines
 * sont déjà chargées.
 *
 * `canPlan` distingue les deux usages : le coach prescrit depuis cette vue,
 * l'athlète ne fait que lire la sienne. Un athlète n'y trouve donc aucun
 * lien vers `/seances/[id]` pour une séance encore planifiée — cette page
 * ouvre le formulaire de prescription, que le trigger lui refuserait à
 * l'enregistrement. Il la marque faite depuis l'accueil, comme avant.
 *
 * Les tableaux sont indexés par séance (objets simples, pas des Map : ils
 * traversent la frontière serveur → client).
 */
export function WeekPlanner({
  athleteId,
  sessions,
  blocksBySession = {},
  exercisesBySession = {},
  logsBySession = {},
  canPlan = true,
}: {
  athleteId: string;
  sessions: TrainingSession[];
  blocksBySession?: Record<string, WorkoutBlock[]>;
  exercisesBySession?: Record<string, Exercise[]>;
  logsBySession?: Record<string, ExerciseLog[]>;
  canPlan?: boolean;
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

  /**
   * Le jour ouvert suit la semaine, au même rang qu'avant : sans cela, le
   * panneau du bas continue de détailler un jour absent de la grille
   * affichée — on croit lire la semaine qu'on regarde, et c'est une autre.
   */
  function changerSemaine(decalage: number) {
    setMonday(addDays(monday, decalage));
    if (selected) setSelected(toISODate(addDays(new Date(`${selected}T12:00:00`), decalage)));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          aria-label="Semaine précédente"
          onClick={() => changerSemaine(-7)}
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
          onClick={() => changerSemaine(7)}
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
              {canPlan && (
                <Link
                  href={`/planifier?athlete=${athleteId}&date=${selected}`}
                  className={`${btnGhost} mt-2.5`}
                >
                  <IconPlus className="size-4" />
                  Planifier ce jour
                </Link>
              )}
            </div>
          ) : (
            selectedSessions.map((s) => {
              const etat = planningState(s, today);
              const blocs = blocksBySession[s.id] ?? [];
              const exercices = exercisesBySession[s.id] ?? [];
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-line bg-card px-3.5 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.title}</p>
                      <p className="text-[13px] text-ink-soft">
                        {s.type === "renfo" ? (
                          <span className="font-semibold text-pine">Muscu</span>
                        ) : (
                          sessionTypeLabel(s.type)
                        )}
                        {(() => {
                          const d = s.duration_actual_min ?? s.duration_planned_min;
                          return d ? ` · ${formatDuration(d)}` : "";
                        })()}
                        {s.coach_id === null ? " · libre" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PlanningStateBadge state={etat} />
                      {s.status === "completed" && s.rpe !== null && (
                        <RpeDot rpe={s.rpe} />
                      )}
                    </div>
                  </div>

                  {/* Le contenu de la séance, sans avoir à l'ouvrir : blocs
                      pour une séance running, exercices pour une muscu. Les
                      deux listes se taisent quand elles n'ont rien. */}
                  {(blocs.length > 0 || exercices.length > 0) && (
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <WorkoutBlocksList blocks={blocs} />
                      <ExercisesList
                        exercises={exercices}
                        logs={logsBySession[s.id] ?? []}
                      />
                    </div>
                  )}

                  {s.description && blocs.length === 0 && exercices.length === 0 && (
                    <p className="mt-1.5 text-[13px] text-ink-soft whitespace-pre-line">
                      {s.description}
                    </p>
                  )}

                  {s.athlete_comment && (
                    <p className="mt-1.5 text-[13px] text-ink-soft italic">
                      « {s.athlete_comment} »
                    </p>
                  )}

                  {canPlan && s.status === "planned" && (
                    <div className="mt-1.5 flex justify-end">
                      <Link
                        href={`/seances/${s.id}`}
                        className="text-[13px] font-semibold text-pine"
                      >
                        Modifier
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {canPlan && selectedSessions.length > 0 && (
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
