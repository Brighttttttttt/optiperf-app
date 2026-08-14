import { formatDistance } from "@/lib/activites";
import { formatAllure, type AnalyseSeance, type TypeTour } from "@/lib/analyse-seance";

/**
 * Tous les tours, groupés par phase.
 *
 * C'est le tableau de chiffres qui accompagne le graphique : aucune valeur de
 * cette séance ne doit n'exister qu'au survol d'une barre.
 *
 * La colonne Δ ne concerne que les efforts — comparer une récupération à une
 * allure d'effort ne veut rien dire, et l'analyse laisse d'ailleurs son écart
 * à null.
 */

const PHASES: { type: TypeTour; titre: string }[] = [
  { type: "echauffement", titre: "Échauffement" },
  { type: "effort", titre: "Intervalles" },
  { type: "recuperation", titre: "Récupérations" },
  { type: "retour_calme", titre: "Retour au calme" },
  { type: "footing", titre: "Footing" },
];

/** 62 → « 1:02 ». Une durée de tour se lit en minutes, pas en secondes. */
function duree(secondes: number): string {
  const min = Math.floor(secondes / 60);
  const sec = Math.round(secondes % 60);
  return min === 0 ? `${sec}s` : `${min}:${String(sec).padStart(2, "0")}`;
}

function couleurEcart(pct: number): string {
  const absolu = Math.abs(pct);
  if (absolu <= 3) return "text-pine";
  if (absolu <= 8) return "text-ink-soft";
  return "text-rpe-max";
}

export function TourTable({ analyse }: { analyse: AnalyseSeance }) {
  if (analyse.tours.length === 0) return null;

  // Une séance continue n'a qu'une phase : la découper en sections vides
  // n'apprendrait rien. Les phases absentes disparaissent d'elles-mêmes.
  const groupes = PHASES.map((phase) => ({
    ...phase,
    tours: analyse.tours.filter((t) => t.type === phase.type),
  })).filter((g) => g.tours.length > 0);

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[280px] text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-ink-soft">
            <th scope="col" className="py-1 pl-1 font-medium">
              #
            </th>
            <th scope="col" className="py-1 font-medium">
              Durée
            </th>
            <th scope="col" className="py-1 font-medium">
              Distance
            </th>
            <th scope="col" className="py-1 font-medium">
              Allure
            </th>
            <th scope="col" className="py-1 font-medium">
              FC
            </th>
            <th scope="col" className="py-1 pr-1 text-right font-medium">
              Δ
            </th>
          </tr>
        </thead>
        {groupes.map((groupe) => (
          <tbody key={groupe.type}>
            <tr>
              <th
                scope="colgroup"
                colSpan={6}
                className="pt-3 pb-1 pl-1 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft"
              >
                {groupe.titre}
              </th>
            </tr>
            {groupe.tours.map((tour) => (
              <tr key={tour.position} className="border-t border-line">
                <td className="py-1.5 pl-1 text-ink-soft">{tour.position + 1}</td>
                <td className="py-1.5">{duree(tour.durationS)}</td>
                <td className="py-1.5">
                  {tour.distanceM !== null ? formatDistance(tour.distanceM) : "—"}
                </td>
                <td className="py-1.5">
                  {tour.allureSecParKm > 0
                    ? `${formatAllure(tour.allureSecParKm)}/km`
                    : "—"}
                </td>
                <td className="py-1.5">
                  {tour.avgHeartRate !== null ? `${tour.avgHeartRate}` : "—"}
                </td>
                <td
                  className={`py-1.5 pr-1 text-right font-semibold ${
                    tour.ecartAllurePct !== null ? couleurEcart(tour.ecartAllurePct) : ""
                  }`}
                >
                  {tour.ecartAllurePct !== null
                    ? `${tour.ecartAllurePct > 0 ? "+" : ""}${tour.ecartAllurePct.toFixed(1)} %`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
