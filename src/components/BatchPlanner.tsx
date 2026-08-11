"use client";

import { useActionState, useMemo, useState } from "react";
import { planBatch } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { WorkoutBlocksEditor } from "./WorkoutBlocksEditor";
import { ExercisesEditor } from "./ExercisesEditor";
import { IconCheck } from "./Icons";
import { btnGhost, inputClass, labelClass } from "@/lib/styles";
import { LIMITS, SESSION_TYPES, type Profile, type SessionTemplate } from "@/lib/types";
import { batchSummary, planningCalendar } from "@/lib/planning";
import { initials } from "@/lib/initials";
import { formatDuration } from "@/lib/dates";

export function BatchPlanner({
  athletes,
  templates,
  preselectedAthleteId,
  preselectedDate,
  prefill,
}: {
  athletes: Profile[];
  templates: SessionTemplate[];
  preselectedAthleteId?: string;
  preselectedDate?: string;
  prefill?: { title: string; type: string; description: string; duration: string };
}) {
  const [state, action] = useActionState(planBatch, null);
  const days = useMemo(() => planningCalendar(3), []);

  const [selectedAthletes, setSelectedAthletes] = useState<string[]>(
    preselectedAthleteId ? [preselectedAthleteId] : []
  );
  // Arrivée depuis un jour du calendrier : cette date est déjà cochée.
  const [selectedDates, setSelectedDates] = useState<string[]>(
    preselectedDate && days.some((d) => d.iso === preselectedDate)
      ? [preselectedDate]
      : []
  );
  const [content, setContent] = useState({
    title: prefill?.title ?? "",
    type: prefill?.type ?? "endurance",
    description: prefill?.description ?? "",
    duration: prefill?.duration ?? "",
  });

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function applyTemplate(t: SessionTemplate) {
    setContent({
      title: t.title,
      type: t.type,
      description: t.description ?? "",
      duration: t.duration_planned_min ? String(t.duration_planned_min) : "",
    });
  }

  // Les jours arrivent à plat : on les regroupe en semaines pour la grille.
  const weeks = useMemo(() => {
    const out: (typeof days)[] = [];
    for (const day of days) {
      if (day.startsWeek || out.length === 0) out.push([]);
      out[out.length - 1].push(day);
    }
    return out;
  }, [days]);

  const total = selectedAthletes.length * selectedDates.length;

  return (
    <form action={action} className="space-y-6">
      {selectedAthletes.map((id) => (
        <input key={id} type="hidden" name="athlete_ids" value={id} />
      ))}
      {selectedDates.map((d) => (
        <input key={d} type="hidden" name="dates" value={d} />
      ))}

      {/* 1. Le contenu de la séance */}
      <section>
        <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
          La séance
        </h2>

        {templates.length > 0 && (
          <div className="mb-3 -mx-5 px-5 overflow-x-auto">
            <div className="flex gap-2 w-max pb-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                    content.title === t.title
                      ? "border-pine bg-pine-soft"
                      : "border-line bg-card hover:border-pine/40"
                  }`}
                >
                  <span className="block text-[14px] font-semibold max-w-44 truncate">
                    {t.title}
                  </span>
                  <span className="block text-[12px] text-ink-soft">
                    {t.duration_planned_min
                      ? formatDuration(t.duration_planned_min)
                      : "durée libre"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label className={labelClass} htmlFor="batch-title">
              Titre
            </label>
            <input
              id="batch-title"
              name="title"
              required
              maxLength={LIMITS.title}
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              placeholder="Ex. 6 × 3 min allure 5 km"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelClass} htmlFor="batch-type">
                Type
              </label>
              <select
                id="batch-type"
                name="type"
                value={content.type}
                onChange={(e) => setContent({ ...content, type: e.target.value })}
                className={inputClass}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="batch-duration">
                Durée (min)
              </label>
              <input
                id="batch-duration"
                name="duration_planned_min"
                type="number"
                inputMode="numeric"
                min={1}
                value={content.duration}
                onChange={(e) => setContent({ ...content, duration: e.target.value })}
                placeholder="60"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="batch-description">
              Consignes
            </label>
            <textarea
              id="batch-description"
              name="description"
              rows={3}
              maxLength={LIMITS.description}
              value={content.description}
              onChange={(e) => setContent({ ...content, description: e.target.value })}
              placeholder={"Échauffement 15 min\nRécup 90 s entre les blocs"}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2.5 text-[14px]">
            <input
              type="checkbox"
              name="save_template"
              className="size-4 accent-pine"
            />
            Garder cette séance comme modèle réutilisable
          </label>

          {content.type === "renfo" ? <ExercisesEditor /> : <WorkoutBlocksEditor />}
        </div>
      </section>

      {/* 2 et 3 côte à côte dès que la place existe : c'est le croisement
          athlètes × dates que le coach fait des yeux, et l'obliger à faire
          défiler de l'un à l'autre est précisément ce qui rendait cet écran
          pénible à la souris. */}
      <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {/* 2. Les athlètes */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              Pour qui
            </h2>
            <button
              type="button"
              onClick={() =>
                setSelectedAthletes(
                  selectedAthletes.length === athletes.length
                    ? []
                    : athletes.map((a) => a.id)
                )
              }
              className="text-[13px] font-semibold text-pine"
            >
              {selectedAthletes.length === athletes.length
                ? "Tout décocher"
                : "Tout le groupe"}
            </button>
          </div>
          <div className="space-y-2">
            {athletes.map((a) => {
              const on = selectedAthletes.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedAthletes(toggle(selectedAthletes, a.id))}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    on ? "border-pine bg-pine-soft" : "border-line bg-card"
                  }`}
                >
                  <span className="size-9 shrink-0 rounded-full bg-card border border-line text-pine font-display font-semibold text-[13px] flex items-center justify-center">
                    {initials(a.full_name)}
                  </span>
                  <span className="flex-1 font-medium truncate">{a.full_name}</span>
                  <span
                    className={`size-5 rounded-full flex items-center justify-center ${
                      on ? "bg-pine text-card" : "border border-line"
                    }`}
                  >
                    {on && <IconCheck className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Les dates */}
        <section>
          <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
            Quand
          </h2>
          <div className="space-y-2">
            {weeks.map((week, i) => (
              <div key={i} className="flex gap-1.5">
                {week.map((day) => {
                  const on = selectedDates.includes(day.iso);
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      aria-pressed={on}
                      aria-label={day.iso}
                      onClick={() => setSelectedDates(toggle(selectedDates, day.iso))}
                      className={`flex-1 min-w-0 rounded-lg border py-2 transition-colors ${
                        on
                          ? "border-pine bg-pine text-card"
                          : day.isToday
                            ? "border-pine/50 bg-card"
                            : "border-line bg-card"
                      }`}
                    >
                      <span className="block text-[10px] uppercase opacity-70">
                        {day.initial}
                      </span>
                      <span className="block font-display text-[16px] font-semibold tabular-nums">
                        {day.dayOfMonth}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Récapitulatif et validation. Collé au-dessus de la barre du bas sur
          téléphone ; sur ordinateur elle est à gauche, plus rien à enjamber. */}
      <div className="sticky bottom-24 space-y-2 md:bottom-4">
        {state?.error && (
          <p className="rounded-xl bg-rpe-max-soft px-3.5 py-2.5 text-sm font-medium text-rpe-max">
            {state.error}
          </p>
        )}
        <div className="rounded-2xl border border-line bg-card p-3 shadow-sm">
          <p className="text-center text-[13px] text-ink-soft mb-2">
            {batchSummary(selectedAthletes.length, selectedDates.length)}
          </p>
          <SubmitButton
            className="w-full disabled:opacity-50"
            pendingText="Création…"
          >
            {total > 0 ? `Planifier ${total} séance${total > 1 ? "s" : ""}` : "Planifier"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function EmptyGroupNotice() {
  return (
    <p className={`${btnGhost} w-full justify-center py-3 text-ink-soft`}>
      Aucun athlète dans ton groupe pour l&apos;instant.
    </p>
  );
}
