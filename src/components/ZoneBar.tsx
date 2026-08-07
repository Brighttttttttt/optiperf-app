import { formatDuration } from "@/lib/dates";
import { pourcentagesZones, totalZones, type RepartitionZones } from "@/lib/zones";

// Cinq zones ordonnées : une seule teinte, en intensité croissante — la
// donnée est un ordre (Z1 < Z2 < … < Z5), pas cinq catégories distinctes
// comme la rampe RPE, qui porte un sens différent (l'effort ressenti).
const TEINTES = ["bg-pine/25", "bg-pine/45", "bg-pine/65", "bg-pine/85", "bg-pine"];
const LABELS = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;

/**
 * Répartition du temps en zones de fréquence cardiaque. Chaque zone reste
 * lisible en toutes lettres sous la barre — jamais seulement au survol.
 */
export function ZoneBar({ zones, titre }: { zones: RepartitionZones; titre?: string }) {
  const total = totalZones(zones);
  if (total === 0) return null;

  const pct = pourcentagesZones(zones);
  const parZone = [
    { label: LABELS[0], secondes: zones.z1, pct: pct.z1, teinte: TEINTES[0] },
    { label: LABELS[1], secondes: zones.z2, pct: pct.z2, teinte: TEINTES[1] },
    { label: LABELS[2], secondes: zones.z3, pct: pct.z3, teinte: TEINTES[2] },
    { label: LABELS[3], secondes: zones.z4, pct: pct.z4, teinte: TEINTES[3] },
    { label: LABELS[4], secondes: zones.z5, pct: pct.z5, teinte: TEINTES[4] },
  ];

  return (
    <div>
      {titre && <h4 className="text-[13px] font-semibold mb-1.5">{titre}</h4>}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={
        `Répartition par zone de fréquence cardiaque : ${parZone
          .filter((z) => z.secondes > 0)
          .map((z) => `${z.label} ${Math.round(z.pct)} %`)
          .join(", ")}`
      }>
        {parZone.map((z) =>
          z.secondes > 0 ? (
            <div key={z.label} className={z.teinte} style={{ width: `${z.pct}%` }} />
          ) : null
        )}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft tabular-nums">
        {parZone
          .filter((z) => z.secondes > 0)
          .map((z) => (
            <li key={z.label} className="flex items-center gap-1">
              <span className={`inline-block size-2 rounded-full ${z.teinte}`} />
              {z.label} {Math.round(z.pct)} % · {formatDuration(Math.round(z.secondes / 60))}
            </li>
          ))}
      </ul>
    </div>
  );
}
