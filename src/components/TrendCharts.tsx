"use client";

import { useId, useState } from "react";
import type { WeekPoint } from "@/lib/metrics";
import { formatDuration } from "@/lib/dates";

// Une seule teinte porte les données, un neutre porte le repère : l'identité
// vient de la forme (barre contre ligne), pas de la couleur — deux verts
// proches échoueraient au seuil de distinction en vision normale.
const SERIES = "var(--color-pine)";
const REFERENCE = "var(--color-ink)";

const W = 340;
const H = 132;
const PAD = { top: 10, right: 6, bottom: 18, left: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Graduations rondes : 0, puis 2 ou 3 paliers lisibles. */
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) out.push(v);
  return out;
}

const compact = (n: number) =>
  n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));

function Chart({
  points,
  value,
  reference,
  referenceLabel,
  formatValue,
  seriesLabel,
  active,
  onActivate,
}: {
  points: WeekPoint[];
  value: (p: WeekPoint) => number;
  reference?: (p: WeekPoint) => number;
  referenceLabel?: string;
  formatValue: (n: number) => string;
  seriesLabel: string;
  active: number | null;
  onActivate: (i: number | null) => void;
}) {
  const titleId = useId();
  const values = points.map(value);
  const refs = reference ? points.map(reference) : [];
  const max = Math.max(1, ...values, ...refs);
  const scale = ticks(max);
  const top = scale[scale.length - 1];

  const x = (i: number) => PAD.left + (i + 0.5) * (PLOT_W / points.length);
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  // Barre fine : la largeur de bande moins l'air qui la sépare des voisines.
  const barW = Math.min(20, (PLOT_W / points.length) - 6);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto touch-manipulation"
      role="img"
      aria-labelledby={titleId}
      onMouseLeave={() => onActivate(null)}
    >
      <title id={titleId}>
        {seriesLabel} sur {points.length} semaines
      </title>

      {scale.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 5}
            y={y(v) + 3}
            textAnchor="end"
            className="fill-ink-soft text-[8px] tabular-nums"
          >
            {compact(v)}
          </text>
        </g>
      ))}

      {points.map((p, i) => {
        const v = value(p);
        const h = Math.max(v > 0 ? 2 : 0, (v / top) * PLOT_H);
        return (
          <rect
            key={p.weekStart}
            x={x(i) - barW / 2}
            y={PAD.top + PLOT_H - h}
            width={barW}
            height={h}
            rx={Math.min(4, barW / 2)}
            fill={SERIES}
            opacity={active === null || active === i ? 1 : 0.45}
          />
        );
      })}

      {reference && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(reference(p))}`).join(" ")}
          fill="none"
          stroke={REFERENCE}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
      )}

      {/* Une semaine sur trois suffit à se repérer sans encombrer. */}
      {points.map((p, i) =>
        i % 3 === 0 || i === points.length - 1 ? (
          <text
            key={p.weekStart}
            x={x(i)}
            y={H - 5}
            textAnchor="middle"
            className="fill-ink-soft text-[8px]"
          >
            {p.label.replace(/\s/, " ")}
          </text>
        ) : null
      )}

      {/* Zones de survol larges : la cible dépasse la barre. */}
      {points.map((p, i) => (
        <rect
          key={`hit-${p.weekStart}`}
          x={PAD.left + i * (PLOT_W / points.length)}
          y={0}
          width={PLOT_W / points.length}
          height={H}
          fill="transparent"
          onMouseEnter={() => onActivate(i)}
          onClick={() => onActivate(i)}
        >
          <title>{`${p.label} : ${formatValue(value(p))}${
            reference && referenceLabel
              ? ` · ${referenceLabel} ${formatValue(reference(p))}`
              : ""
          }`}</title>
        </rect>
      ))}
    </svg>
  );
}

function Legend({
  items,
}: {
  items: { kind: "bar" | "line"; label: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.kind === "bar" ? (
            <span className="inline-block w-2.5 h-3 rounded-[2px] bg-pine" />
          ) : (
            <span className="inline-block w-3.5 h-[2px] rounded-full bg-ink/75" />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function TrendCharts({ points }: { points: WeekPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const current = active !== null ? points[active] : points[points.length - 1];

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[15px]">Charge par semaine</h3>
          <p className="text-[12px] text-ink-soft tabular-nums">
            {current.label} · {Math.round(current.load)}
          </p>
        </div>
        <Legend
          items={[
            { kind: "bar", label: "Charge de la semaine" },
            { kind: "line", label: "Moyenne des 4 dernières" },
          ]}
        />
        <Chart
          points={points}
          value={(p) => p.load}
          reference={(p) => p.chronicLoad}
          referenceLabel="moyenne"
          formatValue={(n) => String(Math.round(n))}
          seriesLabel="Charge d'entraînement"
          active={active}
          onActivate={setActive}
        />
        <p className="text-[12px] text-ink-soft">
          Une barre nettement au-dessus de la ligne signale une montée de charge
          trop rapide.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[15px]">Volume réalisé</h3>
          <p className="text-[12px] text-ink-soft tabular-nums">
            {current.label} · {formatDuration(current.volumeActualMin)}
          </p>
        </div>
        <Legend
          items={[
            { kind: "bar", label: "Réalisé" },
            { kind: "line", label: "Prévu par le coach" },
          ]}
        />
        <Chart
          points={points}
          value={(p) => p.volumeActualMin}
          reference={(p) => p.volumePlannedMin}
          referenceLabel="prévu"
          formatValue={(n) => formatDuration(Math.round(n))}
          seriesLabel="Volume d'entraînement"
          active={active}
          onActivate={setActive}
        />
      </section>

      <div>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-[13px] font-semibold text-pine"
          aria-expanded={showTable}
        >
          {showTable ? "Masquer le tableau" : "Voir les chiffres"}
        </button>

        {showTable && (
          <div className="mt-2 -mx-1 overflow-x-auto">
            <table className="w-full text-[12px] tabular-nums">
              <thead>
                <tr className="text-ink-soft text-left">
                  <th className="font-semibold py-1 pr-2">Semaine</th>
                  <th className="font-semibold py-1 px-1 text-right">Charge</th>
                  <th className="font-semibold py-1 px-1 text-right">Volume</th>
                  <th className="font-semibold py-1 px-1 text-right">Prévu</th>
                  <th className="font-semibold py-1 px-1 text-right">RPE</th>
                  <th className="font-semibold py-1 pl-1 text-right">Faites</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.weekStart} className="border-t border-line">
                    <td className="py-1 pr-2 whitespace-nowrap">{p.label}</td>
                    <td className="py-1 px-1 text-right">{Math.round(p.load)}</td>
                    <td className="py-1 px-1 text-right whitespace-nowrap">
                      {p.volumeActualMin > 0
                        ? formatDuration(p.volumeActualMin)
                        : "—"}
                    </td>
                    <td className="py-1 px-1 text-right whitespace-nowrap">
                      {p.volumePlannedMin > 0
                        ? formatDuration(p.volumePlannedMin)
                        : "—"}
                    </td>
                    <td className="py-1 px-1 text-right">{p.avgRpe ?? "—"}</td>
                    <td className="py-1 pl-1 text-right">
                      {p.completed}
                      {p.planned > 0 ? `/${p.planned}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
