"use client";

import { useState } from "react";
import {
  BLOCK_TYPES,
  formatPaceInput,
  parsePaceInput,
  type BlockDraft,
  type BlockType,
} from "@/lib/blocks";
import { inputClass, btnGhost } from "@/lib/styles";

type LigneBloc = {
  block_type: BlockType;
  duration_min: string;
  distance_m: string;
  target_pace: string;
  repetitions: string;
};

const ligneVide = (): LigneBloc => ({
  block_type: "echauffement",
  duration_min: "",
  distance_m: "",
  target_pace: "",
  repetitions: "",
});

function versBrouillon(l: LigneBloc): BlockDraft | null {
  const duration_sec = l.duration_min.trim() ? Math.round(Number(l.duration_min) * 60) : null;
  const distance_m = l.distance_m.trim() ? Math.round(Number(l.distance_m)) : null;
  if (!duration_sec && !distance_m) return null;
  return {
    block_type: l.block_type,
    duration_sec,
    distance_m,
    target_pace_sec_per_km: l.target_pace.trim() ? parsePaceInput(l.target_pace) : null,
    repetitions: l.repetitions.trim() ? Math.round(Number(l.repetitions)) : null,
  };
}

/**
 * Construction d'une séance bloc par bloc (échauffement, intervalle,
 * récupération, retour au calme). Repliée par défaut sur une séance simple —
 * elle ne doit rien coûter à créer une sortie sans structure particulière.
 * Sérialise en JSON dans un champ cache, revalidé côté serveur
 * (`validerBlocs`) : un formulaire se manipule.
 */
export function WorkoutBlocksEditor({ initial = [] }: { initial?: BlockDraft[] }) {
  const [lignes, setLignes] = useState<LigneBloc[]>(() =>
    initial.map((b) => ({
      block_type: b.block_type,
      duration_min: b.duration_sec ? String(b.duration_sec / 60) : "",
      distance_m: b.distance_m ? String(b.distance_m) : "",
      target_pace: b.target_pace_sec_per_km ? formatPaceInput(b.target_pace_sec_per_km) : "",
      repetitions: b.repetitions ? String(b.repetitions) : "",
    }))
  );
  const [ouvert, setOuvert] = useState(initial.length > 0);

  function majLigne(i: number, patch: Partial<LigneBloc>) {
    setLignes(lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const blocsValides = lignes.map(versBrouillon).filter((b): b is BlockDraft => b !== null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="text-[13px] font-semibold text-pine"
        aria-expanded={ouvert}
      >
        {ouvert ? "Revenir à une séance simple" : "Structurer en blocs"}
      </button>

      {ouvert && (
        <div className="mt-2.5 space-y-2.5">
          {lignes.map((l, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={l.block_type}
                  onChange={(e) => majLigne(i, { block_type: e.target.value as BlockType })}
                  className={`${inputClass} flex-1`}
                  aria-label="Type de bloc"
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setLignes(lignes.filter((_, idx) => idx !== i))}
                  aria-label="Retirer ce bloc"
                  className="shrink-0 size-11 rounded-lg border border-line text-ink-soft hover:text-rpe-max hover:border-rpe-max/40"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-ink-soft" htmlFor={`bloc-duree-${i}`}>
                    Durée (min)
                  </label>
                  <input
                    id={`bloc-duree-${i}`}
                    type="number"
                    step={0.5}
                    min={0}
                    value={l.duration_min}
                    onChange={(e) => majLigne(i, { duration_min: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-soft" htmlFor={`bloc-distance-${i}`}>
                    Distance (m)
                  </label>
                  <input
                    id={`bloc-distance-${i}`}
                    type="number"
                    min={0}
                    value={l.distance_m}
                    onChange={(e) => majLigne(i, { distance_m: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-soft" htmlFor={`bloc-allure-${i}`}>
                    Allure cible (min/km)
                  </label>
                  <input
                    id={`bloc-allure-${i}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="4:30"
                    value={l.target_pace}
                    onChange={(e) => majLigne(i, { target_pace: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-soft" htmlFor={`bloc-repetitions-${i}`}>
                    Répétitions
                  </label>
                  <input
                    id={`bloc-repetitions-${i}`}
                    type="number"
                    min={1}
                    placeholder="1"
                    value={l.repetitions}
                    onChange={(e) => majLigne(i, { repetitions: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLignes([...lignes, ligneVide()])}
            className={`${btnGhost} w-full`}
          >
            Ajouter un bloc
          </button>
        </div>
      )}

      <input
        type="hidden"
        name="blocks"
        value={ouvert && blocsValides.length > 0 ? JSON.stringify(blocsValides) : ""}
      />
    </div>
  );
}
