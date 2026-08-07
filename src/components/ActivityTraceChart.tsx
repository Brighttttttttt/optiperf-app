"use client";

import { useId } from "react";
import type { ActivityTrace } from "@/lib/types";

// Même signature visuelle que TrendCharts : une seule teinte pour la donnée,
// un neutre pour les repères.
const SERIES = "var(--color-pine)";

const W = 340;
const H = 96;
const PAD = { top: 8, right: 6, bottom: 16, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatPace(secPerKm: number): string {
  return `${formatElapsed(secPerKm)} /km`;
}

/** Graduations rondes réparties entre min et max, un palier de repli garanti. */
function ticks(min: number, max: number): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 2; v += step) out.push(v);
  return out.length > 0 ? out : [min, max];
}

function Courbe({
  label,
  t,
  valeurs,
  formatValeur,
  formatGraduation = (n: number) => String(Math.round(n)),
}: {
  label: string;
  t: number[];
  valeurs: (number | null)[];
  formatValeur: (n: number) => string;
  formatGraduation?: (n: number) => string;
}) {
  const titleId = useId();
  const points = t
    .map((tOffset, i) => ({ t: tOffset, v: valeurs[i] }))
    .filter((p): p is { t: number; v: number } => p.v !== null && p.v !== undefined);

  if (points.length === 0) return null;

  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const moy = vals.reduce((s, v) => s + v, 0) / vals.length;
  const tMax = Math.max(1, t[t.length - 1] ?? 1);

  const graduations = ticks(min, max);
  const yMin = Math.min(min, graduations[0]);
  const yMax = Math.max(max, graduations[graduations.length - 1]);
  const etendue = yMax - yMin || 1;

  const x = (v: number) => PAD.left + (v / tMax) * PLOT_W;
  const y = (v: number) => PAD.top + PLOT_H - ((v - yMin) / etendue) * PLOT_H;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold">{label}</h4>
        <p className="text-[12px] text-ink-soft tabular-nums">
          {formatValeur(min)} – {formatValeur(max)} · moy. {formatValeur(moy)}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto mt-1"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {label} au fil de la séance : de {formatValeur(min)} à {formatValeur(max)}, moyenne{" "}
          {formatValeur(moy)}
        </title>

        {graduations.map((v) => (
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
              x={PAD.left - 4}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-ink-soft text-[8px] tabular-nums"
            >
              {formatGraduation(v)}
            </text>
          </g>
        ))}

        <polyline
          points={points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")}
          fill="none"
          stroke={SERIES}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text x={PAD.left} y={H - 3} className="fill-ink-soft text-[8px]">
          0:00
        </text>
        <text x={W - PAD.right} y={H - 3} textAnchor="end" className="fill-ink-soft text-[8px]">
          {formatElapsed(tMax)}
        </text>
      </svg>
    </div>
  );
}

/**
 * Courbes FC/allure/altitude d'une activité importée. Contrairement à
 * TrendCharts (une poignée de semaines, table complète disponible), une
 * trace porte jusqu'à 400 points sous-échantillonnés : un tableau chiffré
 * complet n'y ajouterait rien de lisible. Min/moyenne/max restent affichés
 * en toutes lettres, jamais seulement au survol.
 */
export function ActivityTraceChart({ trace }: { trace: ActivityTrace }) {
  const hasFc = (trace.heart_rate ?? []).some((v) => v !== null);
  const hasAllure = (trace.pace_sec_per_km ?? []).some((v) => v !== null);
  const hasAltitude = (trace.altitude_m ?? []).some((v) => v !== null);
  if (!hasFc && !hasAllure && !hasAltitude) return null;

  return (
    <div className="space-y-4">
      {hasFc && (
        <Courbe
          label="Fréquence cardiaque"
          t={trace.t_s}
          valeurs={trace.heart_rate ?? []}
          formatValeur={(n) => `${Math.round(n)} bpm`}
        />
      )}
      {hasAllure && (
        <Courbe
          label="Allure"
          t={trace.t_s}
          valeurs={trace.pace_sec_per_km ?? []}
          formatValeur={formatPace}
          formatGraduation={formatElapsed}
        />
      )}
      {hasAltitude && (
        <Courbe
          label="Altitude"
          t={trace.t_s}
          valeurs={trace.altitude_m ?? []}
          formatValeur={(n) => `${Math.round(n)} m`}
        />
      )}
    </div>
  );
}
