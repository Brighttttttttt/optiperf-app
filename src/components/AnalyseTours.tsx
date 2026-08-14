"use client";

import { useState } from "react";
import { TourChart } from "./TourChart";
import { TourTable } from "./TourTable";
import { formatAllure, type AnalyseSeance } from "@/lib/analyse-seance";
import { formatDistance } from "@/lib/activites";

/**
 * Ce que la montre a réellement enregistré, en trois onglets : le sens
 * d'abord, la forme ensuite, le détail en dernier.
 *
 * Composant client pour la seule bascule d'onglets — l'analyse elle-même est
 * calculée sur le serveur et arrive toute faite. Rien n'est chargé à la
 * demande : les trois onglets tiennent dans la même page, seul l'affichage
 * change.
 */

const ONGLETS = ["Analyse", "Graphique", "Tours"] as const;
type Onglet = (typeof ONGLETS)[number];

/** 195 s → « 3 min 15 ». Une durée d'effort se lit en minutes. */
function dureeLongue(secondes: number): string {
  const min = Math.floor(secondes / 60);
  const sec = Math.round(secondes % 60);
  if (min === 0) return `${sec} s`;
  return sec === 0 ? `${min} min` : `${min} min ${String(sec).padStart(2, "0")}`;
}

export function AnalyseTours({ analyse }: { analyse: AnalyseSeance }) {
  const [actif, setActif] = useState<Onglet>("Analyse");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Détail de la séance"
        className="flex gap-1 border-b border-line"
      >
        {ONGLETS.map((onglet) => (
          <button
            key={onglet}
            type="button"
            role="tab"
            id={`onglet-${onglet}`}
            aria-selected={actif === onglet}
            aria-controls={`panneau-${onglet}`}
            onClick={() => setActif(onglet)}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] font-semibold transition-colors ${
              actif === onglet
                ? "border-pine text-pine"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {onglet}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panneau-${actif}`}
        aria-labelledby={`onglet-${actif}`}
        className="pt-3"
      >
        {actif === "Analyse" && <Analyse analyse={analyse} />}
        {actif === "Graphique" && <TourChart analyse={analyse} />}
        {actif === "Tours" && <TourTable analyse={analyse} />}
      </div>
    </div>
  );
}

function Analyse({ analyse }: { analyse: AnalyseSeance }) {
  if (analyse.type !== "intervalles") {
    return (
      <div className="space-y-2">
        <p className="text-[15px]">{analyse.resume}</p>
        <p className="text-[13px] text-ink-soft">
          Aucune structure de répétitions détectée : les tours de cette sortie
          sont réguliers, comme sur un tour automatique.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-[22px] font-semibold">{analyse.structure}</p>
        <p className="mt-0.5 text-[14px] text-ink-soft">{analyse.resume}</p>
      </div>

      {analyse.series.map((serie, i) => (
        <div key={i}>
          {analyse.series.length > 1 && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Série {i + 1}
            </p>
          )}
          <p className="text-[14px]">
            {serie.repetitions} × {serie.libelleEffort} à{" "}
            <span className="font-semibold">
              {formatAllure(serie.allureEffortMoyenneSecParKm)}/km
            </span>
            {serie.libelleRecuperation && ` · récup ${serie.libelleRecuperation}`}
          </p>

          {/* Une répétition par ligne : c'est la seule façon de voir laquelle
              a lâché. La couleur reprend celle du graphique. */}
          <ol className="mt-1.5 space-y-0.5">
            {serie.efforts.map((effort) => {
              const ecart = effort.ecartAllurePct ?? 0;
              const couleur =
                Math.abs(ecart) <= 3
                  ? "text-pine"
                  : Math.abs(ecart) <= 8
                    ? "text-ink-soft"
                    : "text-rpe-max";
              return (
                <li
                  key={effort.position}
                  className="flex items-baseline justify-between gap-2 text-[13px] tabular-nums"
                >
                  <span className="text-ink-soft">
                    {dureeLongue(effort.durationS)}
                    {effort.distanceM !== null && ` · ${formatDistance(effort.distanceM)}`}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span>{formatAllure(effort.allureSecParKm)}/km</span>
                    <span className={`w-14 text-right font-semibold ${couleur}`}>
                      {ecart > 0 ? "+" : ""}
                      {ecart.toFixed(1)} %
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-[13px]">
        <div>
          <dt className="text-ink-soft">Échauffement</dt>
          <dd className="font-semibold">
            {analyse.distanceEchauffementM > 0
              ? formatDistance(analyse.distanceEchauffementM)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-soft">Effort</dt>
          <dd className="font-semibold">
            {analyse.distanceEffortM > 0 ? formatDistance(analyse.distanceEffortM) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-soft">Retour au calme</dt>
          <dd className="font-semibold">
            {analyse.distanceRetourCalmeM > 0
              ? formatDistance(analyse.distanceRetourCalmeM)
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
