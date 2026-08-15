import type { AnalyseSeance, TourAnalyse } from "@/lib/analyse-seance";
import { formatAllure } from "@/lib/analyse-seance";

/**
 * Une barre par tour, hauteur proportionnelle à la vitesse, courbe de
 * fréquence cardiaque par-dessus.
 *
 * SVG écrit à la main, sans Recharts, comme `TrendCharts` et
 * `ActivityTraceChart` : le projet n'a aucune dépendance de graphique, et en
 * ajouter une pour un seul écran laisserait deux styles de courbes visibles
 * côte à côte dans la même app.
 *
 * Deux règles maison s'appliquent ici. La **forme** distingue les séries — des
 * barres pour la vitesse, une ligne pour la fréquence — parce que deux teintes
 * proches ne se départagent pas de façon fiable. Et **aucune valeur n'existe
 * uniquement au survol** : le tableau des tours, dans l'onglet voisin, porte
 * tous les chiffres.
 *
 * La couleur des barres d'effort dit la **régularité** : plus une répétition
 * s'écarte de l'allure moyenne, plus elle tire vers le rouge. Une séance tenue
 * est unie ; une séance qui part en vrille se voit sans lire un chiffre.
 */

const L = 320;
const H = 120;
const MARGE_BASSE = 14;

/** Classes écrites en toutes lettres : Tailwind ne voit pas une classe construite. */
const REMPLISSAGE: Record<string, string> = {
  effortJuste: "fill-pine",
  effortEcart: "fill-rpe-hard",
  effortLoin: "fill-rpe-max",
  recuperation: "fill-line",
  autre: "fill-ink-soft/30",
};

/**
 * Au-delà de 3 % d'écart à l'allure moyenne, la répétition se distingue ; au-delà
 * de 8 %, elle décroche. Ces seuils viennent du projet d'origine, où ils
 * séparaient visiblement une séance tenue d'une séance subie.
 */
function teinte(tour: TourAnalyse): string {
  if (tour.type === "recuperation") return REMPLISSAGE.recuperation;
  if (tour.type !== "effort") return REMPLISSAGE.autre;
  const ecart = Math.abs(tour.ecartAllurePct ?? 0);
  if (ecart <= 3) return REMPLISSAGE.effortJuste;
  if (ecart <= 8) return REMPLISSAGE.effortEcart;
  return REMPLISSAGE.effortLoin;
}

export function TourChart({ analyse }: { analyse: AnalyseSeance }) {
  const tours = analyse.tours;
  if (tours.length === 0) return null;

  const vitesseMax = Math.max(...tours.map((t) => t.vitesseKmh), 1);
  const largeurBarre = L / tours.length;

  const avecFc = tours.filter((t) => t.avgHeartRate !== null);
  const fcMin = avecFc.length > 0 ? Math.min(...avecFc.map((t) => t.avgHeartRate!)) : 0;
  const fcMax = avecFc.length > 0 ? Math.max(...avecFc.map((t) => t.avgHeartRate!)) : 0;
  const etendueFc = Math.max(1, fcMax - fcMin);

  // Un tour sans fréquence coupe la ligne au lieu de la faire plonger à zéro :
  // le trou dit « pas de mesure », un point à zéro mentirait.
  const segments: string[] = [];
  let courant: string[] = [];
  tours.forEach((tour, i) => {
    if (tour.avgHeartRate === null) {
      if (courant.length > 1) segments.push(courant.join(" "));
      courant = [];
      return;
    }
    const x = i * largeurBarre + largeurBarre / 2;
    const y =
      (H - MARGE_BASSE) -
      ((tour.avgHeartRate - fcMin) / etendueFc) * (H - MARGE_BASSE - 8) -
      4;
    courant.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (courant.length > 1) segments.push(courant.join(" "));

  const resumeAccessible = [
    `${tours.length} tours`,
    analyse.structure || null,
    analyse.allureEffortMoyenneSecParKm > 0
      ? `allure moyenne des efforts ${formatAllure(analyse.allureEffortMoyenneSecParKm)} par kilomètre`
      : null,
    fcMax > 0 ? `fréquence cardiaque de ${fcMin} à ${fcMax} battements` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <figure className="mt-1">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Vitesse et fréquence cardiaque par tour : ${resumeAccessible}`}
        preserveAspectRatio="none"
      >
        {tours.map((tour, i) => {
          const hauteur = (tour.vitesseKmh / vitesseMax) * (H - MARGE_BASSE - 6);
          return (
            <rect
              key={tour.position}
              x={i * largeurBarre + 0.5}
              y={H - MARGE_BASSE - hauteur}
              width={Math.max(1, largeurBarre - 1)}
              height={Math.max(1, hauteur)}
              className={teinte(tour)}
              rx={1}
            />
          );
        })}

        {/* Ligne de base : sans elle, une barre très courte flotte. */}
        <line
          x1={0}
          y1={H - MARGE_BASSE}
          x2={L}
          y2={H - MARGE_BASSE}
          className="stroke-line"
          strokeWidth={1}
        />

        {segments.map((points, i) => (
          <polyline
            key={i}
            points={points}
            fill="none"
            className="stroke-ink-soft"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-pine" /> effort régulier
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-rpe-max" /> effort qui décroche
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-line" /> récupération
        </span>
        {fcMax > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-px w-3 bg-ink-soft" /> FC {fcMin}–{fcMax} bpm
          </span>
        )}
      </figcaption>
    </figure>
  );
}
