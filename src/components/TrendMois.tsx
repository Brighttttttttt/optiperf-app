"use client";

import { useMemo, useState } from "react";
import { TrendCharts } from "./TrendCharts";
import { IconChevronLeft, IconChevronRight } from "./Icons";
import { useFenetrePlanning } from "./useFenetrePlanning";
import { monthlyWeeklySeries } from "@/lib/metrics";
import { toISODate } from "@/lib/dates";
import {
  decalerMois,
  grilleMois,
  libelleMois,
  lundisDuMois,
  moisDe,
} from "@/lib/mois";
import type { FenetreDates } from "@/lib/planning";
import type { TrainingSession } from "@/lib/types";

/**
 * Les courbes de charge et de volume, **mois par mois** (#143).
 *
 * Elles montraient douze semaines glissantes : on pouvait lire une tendance,
 * jamais dire « regarde mon mois de juillet », encore moins le comparer à
 * juin. Les flèches changent de mois, comme sur le planning, et les deux vues
 * parlent enfin la même langue.
 *
 * L'unité reste la **semaine** — quatre à six barres. C'est celle de la charge
 * session-RPE de Foster que l'app utilise partout ; une charge quotidienne
 * serait trop bruitée pour qu'on y lise autre chose que des trous.
 *
 * `TrendCharts` continue de ne rien savoir de tout cela : il reçoit des
 * points et les dessine. Ce composant ne fait que choisir lesquels.
 */
export function TrendMois({
  athleteId,
  sessions,
  fenetre,
}: {
  athleteId: string;
  sessions: TrainingSession[];
  fenetre: FenetreDates;
}) {
  const aujourdhui = useMemo(() => toISODate(new Date()), []);
  const [mois, setMois] = useState(() => moisDe(aujourdhui));

  // Seules les séances comptent ici : le contenu détaillé ne sert qu'au
  // planning, mais la fenêtre est la même — et c'est bien pour cela qu'elle
  // est partagée plutôt que redemandée.
  const { sessions: toutes, chargement, assurer } = useFenetrePlanning(
    athleteId,
    {
      sessions,
      blocksBySession: {},
      exercisesBySession: {},
      logsBySession: {},
      analysesBySession: {},
    },
    fenetre
  );

  const points = useMemo(
    () => monthlyWeeklySeries(toutes, lundisDuMois(mois)),
    [toutes, mois]
  );

  function changerMois(decalage: number) {
    const suivant = decalerMois(mois, decalage);
    setMois(suivant);
    // La charge chronique du mois demande les trois semaines qui le précèdent
    // (voir `monthlyWeeklySeries`) : la période assurée déborde donc en
    // arrière, sinon le repère serait calculé sur des semaines vides.
    const jours = grilleMois(suivant, aujourdhui).flatMap((s) => s.jours);
    const debut = new Date(`${jours[0].iso}T12:00:00Z`);
    debut.setUTCDate(debut.getUTCDate() - 21);
    void assurer({
      debut: debut.toISOString().slice(0, 10),
      fin: jours[jours.length - 1].iso,
    });
  }

  return (
    <div>
      {/* Nommé pour la même raison que la grille : « août 2026 » est aussi le
          titre des groupes de l'historique, juste en dessous. */}
      <div
        role="group"
        aria-label="Mois des courbes"
        className="flex items-center justify-between gap-2 mb-3"
      >
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

      {/* Estompées le temps que le mois revienne : des barres à zéro se
          lisent comme un mois sans entraînement, pas comme un mois qu'on
          n'a pas encore demandé. */}
      <div
        aria-busy={chargement}
        className={`transition-opacity ${chargement ? "opacity-40" : ""}`}
      >
        <TrendCharts points={points} />
      </div>
    </div>
  );
}
