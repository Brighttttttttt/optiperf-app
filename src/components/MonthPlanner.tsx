"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { IconChevronLeft, IconChevronRight, IconGrip, IconPlus } from "./Icons";
import { PlanningStateBadge, RpeDot } from "./ui";
import { WorkoutBlocksList } from "./WorkoutBlocksList";
import { ExercisesList } from "./ExercisesList";
import { addDays, formatDayLong, formatDuration, toISODate } from "@/lib/dates";
import {
  appliquerDeplacement,
  peutDeplacer,
  planningState,
  type FenetreDates,
} from "@/lib/planning";
import { useFenetrePlanning } from "./useFenetrePlanning";
import {
  bornesMois,
  decalerMois,
  grilleMois,
  libelleMois,
  moisDe,
} from "@/lib/mois";
import { moveSession } from "@/app/(app)/actions";
import { rpeBand, RPE_BG } from "@/lib/rpe";
import type { AnalyseSeance } from "@/lib/analyse-seance";
import {
  sessionTypeLabel,
  type Exercise,
  type ExerciseLog,
  type TrainingSession,
  type WorkoutBlock,
} from "@/lib/types";
import { btnGhost, btnPrimary } from "@/lib/styles";

/** L'initiale des sept jours, du lundi au dimanche. */
const INITIALES_JOURS = ["L", "M", "M", "J", "V", "S", "D"];

/** Le jour de la grille survolé par un pointeur, ou null s'il est ailleurs. */
function jourSous(x: number, y: number): string | null {
  const cible = document.elementFromPoint(x, y);
  return cible?.closest<HTMLElement>("[data-jour]")?.dataset.jour ?? null;
}

type Deplacement = {
  id: string;
  x: number;
  y: number;
  /** Jour survolé, mis à jour à chaque mouvement. */
  jour: string | null;
};

/**
 * Vue mois : la grille donne la forme du mois d'un coup d'œil (jours vides,
 * enchaînement, intensités), le détail du jour s'ouvre en dessous.
 *
 * Une ligne par semaine, sept colonnes : la semaine reste lisible **dans** le
 * mois, et l'encombrement à l'écran ne change pas — c'est la même bande de
 * jours, répétée quatre à six fois (#143). Le mois est l'unité dans laquelle
 * on relit son entraînement : un bloc, une coupure, une reprise.
 *
 * La navigation reste côté client tant que le mois demandé tombe dans la
 * fenêtre chargée ; au-delà, la vue va chercher ce qui lui manque plutôt que
 * d'afficher un vide trompeur (#141).
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
export function MonthPlanner({
  athleteId,
  sessions,
  fenetre,
  blocksBySession = {},
  exercisesBySession = {},
  logsBySession = {},
  analysesBySession = {},
  canPlan = true,
}: {
  athleteId: string;
  sessions: TrainingSession[];
  /**
   * La période que `sessions` couvre réellement. Elle vient de la page et non
   * des données : une fenêtre sans aucune séance n'a pas de bornes qu'on
   * puisse déduire, et c'est précisément le cas où se tromper coûte cher.
   */
  fenetre: FenetreDates;
  blocksBySession?: Record<string, WorkoutBlock[]>;
  exercisesBySession?: Record<string, Exercise[]>;
  logsBySession?: Record<string, ExerciseLog[]>;
  /** Absente pour une séance sans tours (GPX, saisie à la main, à venir). */
  analysesBySession?: Record<string, AnalyseSeance>;
  canPlan?: boolean;
}) {
  const today = useMemo(() => new Date(), []);
  const aujourdhui = toISODate(today);
  const [mois, setMois] = useState(() => moisDe(aujourdhui));
  const [selected, setSelected] = useState<string | null>(aujourdhui);


  const {
    sessions: toutes,
    blocksBySession: tousBlocs,
    exercisesBySession: tousExercices,
    logsBySession: tousLogs,
    analysesBySession: toutesAnalyses,
    chargement,
    assurer,
  } = useFenetrePlanning(
    athleteId,
    {
      sessions,
      blocksBySession,
      exercisesBySession,
      logsBySession,
      analysesBySession,
    },
    fenetre
  );

  // La carte suit le doigt avant que le serveur ait répondu : un aller-retour
  // réseau au milieu d'un glissement se lit comme un raté du geste.
  const [seances, deplacerOptimiste] = useOptimistic(
    toutes,
    (etat: TrainingSession[], m: { id: string; date: string }) =>
      appliquerDeplacement(etat, m.id, m.date)
  );
  const [, startTransition] = useTransition();

  const [drag, setDrag] = useState<Deplacement | null>(null);
  /** Annonce du résultat, lue par les lecteurs d'écran et affichée en clair. */
  const [message, setMessage] = useState<string | null>(null);
  const aRefocaliser = useRef<string | null>(null);

  const semaines = useMemo(() => grilleMois(mois, aujourdhui), [mois, aujourdhui]);
  const jours = useMemo(() => semaines.flatMap((s) => s.jours), [semaines]);
  /** Ce que la grille affiche réellement, débordements compris. */
  const periode = {
    debut: jours[0]?.iso ?? aujourdhui,
    fin: jours[jours.length - 1]?.iso ?? aujourdhui,
  };
  const byDay = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of seances) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [seances]);

  const selectedSessions = selected ? (byDay.get(selected) ?? []) : [];

  /**
   * Après un déplacement au clavier, la carte change de jour donc de place
   * dans le panneau : React la démonte et la remonte, et le focus tombe sur
   * le corps de la page. Sans ce rattrapage, une seule flèche fonctionne et
   * le geste est inutilisable sans souris.
   *
   * Une référence plutôt qu'un état : rendre le focus est une manipulation du
   * DOM, elle n'a pas à provoquer de rendu supplémentaire.
   */
  useEffect(() => {
    const id = aRefocaliser.current;
    if (!id) return;
    const poignee = document.querySelector<HTMLElement>(
      `[data-poignee="${id}"]`
    );
    if (poignee) {
      poignee.focus();
      aRefocaliser.current = null;
    }
  }, [seances, selected]);

  /**
   * Le jour ouvert suit le mois : sans cela, le panneau du bas continue de
   * détailler un jour absent de la grille affichée — on croit lire le mois
   * qu'on regarde, et c'en est un autre.
   *
   * Il se pose sur le **premier jour du mois**, et non sur le même quantième :
   * un 31 n'existe pas partout, et un mois qu'on ouvre se lit du début.
   * Aujourd'hui garde la priorité quand on revient sur le mois courant.
   */
  function changerMois(decalage: number) {
    const suivant = decalerMois(mois, decalage);
    setMois(suivant);
    setSelected(
      suivant === moisDe(aujourdhui) ? aujourdhui : bornesMois(suivant).debut
    );
    void assurer(bornesGrille(suivant));
  }

  /** Les bornes réelles de la grille d'un mois, débordements compris. */
  function bornesGrille(moisVise: string): FenetreDates {
    const tous = grilleMois(moisVise, aujourdhui).flatMap((sem) => sem.jours);
    return { debut: tous[0].iso, fin: tous[tous.length - 1].iso };
  }

  function deplacer(s: TrainingSession, date: string) {
    if (date === s.date || !peutDeplacer(s)) return;

    // La vue suit la séance : la laisser disparaître du panneau à l'instant
    // où on la déplace donnerait l'impression de l'avoir perdue.
    setSelected(date);
    if (date < periode.debut || date > periode.fin) {
      setMois(moisDe(date));
    }
    setMessage(`« ${s.title} » déplacée au ${formatDayLong(date)}.`);
    aRefocaliser.current = s.id;

    startTransition(async () => {
      deplacerOptimiste({ id: s.id, date });
      const res = await moveSession(s.id, date);
      if (res?.error) setMessage(res.error);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          aria-label="Mois précédent"
          onClick={() => changerMois(-1)}
          className="p-1.5 -ml-1.5 rounded-full text-ink-soft hover:bg-line/60"
        >
          <IconChevronLeft className="size-5" />
        </button>
        <p
          aria-live="polite"
          className="text-[13px] font-semibold text-ink-soft text-center first-letter:uppercase"
        >
          {libelleMois(mois)}
        </p>
        <button
          type="button"
          aria-label="Mois suivant"
          onClick={() => changerMois(1)}
          className="p-1.5 -mr-1.5 rounded-full text-ink-soft hover:bg-line/60"
        >
          <IconChevronRight className="size-5" />
        </button>
      </div>

      {/* Les initiales de jours, une fois pour toutes les lignes : sur une
          grille mensuelle, les répéter à chaque semaine ferait cinq fois le
          même bandeau. */}
      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {INITIALES_JOURS.map((initiale, i) => (
          <span
            key={i}
            className="text-center text-[10px] uppercase text-ink-soft"
          >
            {initiale}
          </span>
        ))}
      </div>

      {/* Estompée le temps que la période revienne : les pastilles d'un mois
          encore inconnu diraient « aucune séance » avec l'aplomb d'un mois
          réellement vide. */}
      <div
        aria-busy={chargement}
        className={`grid grid-cols-7 gap-1 transition-opacity ${chargement ? "opacity-40" : ""}`}
      >
        {jours.map((day) => {
          const daySessions = byDay.get(day.iso) ?? [];
          const isSelected = selected === day.iso;
          const survole = drag?.jour === day.iso;
          return (
            <button
              key={day.iso}
              type="button"
              data-jour={day.iso}
              aria-pressed={isSelected}
              aria-label={`${formatDayLong(day.iso)}, ${daySessions.length} séance(s)`}
              onClick={() => setSelected(day.iso)}
              className={`rounded-lg border py-1.5 transition-colors ${
                survole
                  ? "border-pine bg-pine-soft ring-2 ring-pine"
                  : isSelected
                    ? "border-pine bg-pine-soft"
                    : day.isToday
                      ? "border-pine/40 bg-card"
                      : "border-line bg-card"
              } ${
                // Les jours de complément restent cliquables — une séance y
                // vit peut-être — mais s'effacent, sinon on ne voit plus où
                // commence le mois qu'on est venu lire.
                day.dansLeMois ? "" : "opacity-45"
              }`}
            >
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

      {/* Le résultat d'un déplacement : seul retour dont dispose quelqu'un qui
          ne voit pas la grille bouger. Affiché aussi en clair — une erreur
          d'enregistrement doit se lire, pas seulement s'entendre. */}
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-[13px] ${message ? "text-ink-soft" : "sr-only"}`}
      >
        {message}
      </p>

      {selected && (
        <div className="mt-3 space-y-2">
          {selectedSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-4 text-center">
              {/* Tant que la période n'est pas revenue, ce jour n'est pas
                  vide : il est inconnu. Les confondre est exactement le
                  défaut qu'on corrige (#141). */}
              <p className="text-[13px] text-ink-soft">
                {chargement ? "Chargement…" : "Rien de prévu ce jour-là."}
              </p>
              {canPlan && !chargement && (
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
              const blocs = tousBlocs[s.id] ?? [];
              const exercices = tousExercices[s.id] ?? [];
              const deplacable = canPlan && peutDeplacer(s);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border border-line bg-card px-3.5 py-2.5 ${
                    drag?.id === s.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {deplacable && (
                      // Une poignée dédiée plutôt que la carte entière : sur
                      // téléphone, saisir la carte empêcherait de faire
                      // défiler la page, et un appui long se confond avec la
                      // sélection de texte.
                      <button
                        type="button"
                        data-poignee={s.id}
                        aria-label={`Déplacer « ${s.title} », prévue ${formatDayLong(s.date)}. Flèches gauche et droite pour changer de jour.`}
                        className="-ml-1 shrink-0 touch-none cursor-grab rounded p-1 text-ink-soft hover:bg-line/60 active:cursor-grabbing"
                        onPointerDown={(e) => {
                          if (e.pointerType === "mouse" && e.button !== 0) return;
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDrag({ id: s.id, x: e.clientX, y: e.clientY, jour: null });
                        }}
                        onPointerMove={(e) => {
                          if (drag?.id !== s.id) return;
                          setDrag({
                            id: s.id,
                            x: e.clientX,
                            y: e.clientY,
                            jour: jourSous(e.clientX, e.clientY),
                          });
                        }}
                        onPointerUp={(e) => {
                          if (drag?.id !== s.id) return;
                          const cible = jourSous(e.clientX, e.clientY);
                          setDrag(null);
                          if (cible) deplacer(s, cible);
                        }}
                        onPointerCancel={() => setDrag(null)}
                        onKeyDown={(e) => {
                          const pas =
                            e.key === "ArrowLeft"
                              ? -1
                              : e.key === "ArrowRight"
                                ? 1
                                : 0;
                          if (pas === 0) return;
                          e.preventDefault();
                          deplacer(
                            s,
                            toISODate(addDays(new Date(`${s.date}T12:00:00`), pas))
                          );
                        }}
                      >
                        <IconGrip className="size-4" />
                      </button>
                    )}
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
                        logs={tousLogs[s.id] ?? []}
                      />
                    </div>
                  )}

                  {s.description && blocs.length === 0 && exercices.length === 0 && (
                    <p className="mt-1.5 text-[13px] text-ink-soft whitespace-pre-line">
                      {s.description}
                    </p>
                  )}

                  {/* Ce que la montre a mesuré, avant d'ouvrir la séance. */}
                  {toutesAnalyses[s.id] && (
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      {toutesAnalyses[s.id].structure && (
                        <p className="text-[13px] font-semibold text-pine">
                          {toutesAnalyses[s.id].structure}
                        </p>
                      )}
                      <p className="text-[13px] text-ink-soft">
                        {toutesAnalyses[s.id].resume}
                      </p>
                    </div>
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

      {/* Le repère qui suit le doigt. Hors du flux et transparent aux
          pointeurs, pour ne pas se retrouver lui-même sous le curseur au
          moment de chercher le jour visé. */}
      {drag && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-pine bg-pine-soft px-2 py-1 text-[12px] font-semibold text-pine shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          Déposer sur un jour
        </div>
      )}
    </div>
  );
}
