"use client";

import { useActionState } from "react";
import { updateHeartRateRefs } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";
import { METHODES_ZONES, type MethodeZones } from "@/lib/zones";

export function HeartRateRefsForm({
  fcMax,
  fcRepos,
  lthr,
  methode,
}: {
  fcMax: number | null;
  fcRepos: number | null;
  lthr: number | null;
  methode: MethodeZones;
}) {
  const [state, action] = useActionState(updateHeartRateRefs, null);

  return (
    <form action={action} className="grid grid-cols-2 gap-2.5">
      <div>
        <label className={labelClass} htmlFor="settings-fc-max">
          FC max (bpm)
        </label>
        <input
          id="settings-fc-max"
          name="fc_max"
          type="number"
          inputMode="numeric"
          min={100}
          max={230}
          defaultValue={fcMax ?? ""}
          placeholder="185"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="settings-fc-repos">
          FC repos (bpm)
        </label>
        <input
          id="settings-fc-repos"
          name="fc_repos"
          type="number"
          inputMode="numeric"
          min={25}
          max={120}
          defaultValue={fcRepos ?? ""}
          placeholder="Facultatif"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="settings-lthr">
          FC au seuil (bpm)
        </label>
        <input
          id="settings-lthr"
          name="lthr"
          type="number"
          inputMode="numeric"
          min={100}
          max={220}
          defaultValue={lthr ?? ""}
          placeholder="Facultatif"
          className={inputClass}
        />
      </div>

      <div className="col-span-2">
        <label className={labelClass} htmlFor="settings-zone-method">
          Calcul des zones
        </label>
        <select
          id="settings-zone-method"
          name="zone_method"
          defaultValue={methode}
          className={inputClass}
        >
          {METHODES_ZONES.map((m) => (
            <option key={m.valeur} value={m.valeur}>
              {m.libelle}
            </option>
          ))}
        </select>
        {/* Dit avant l'échec, pas après : une méthode dont la donnée manque
            est refusée à l'enregistrement, autant l'annoncer ici. */}
        <p className="mt-1 text-[12px] text-ink-soft">
          Le seuil cale tes zones là où se joue l&apos;entraînement ; Karvonen
          tient compte de ta FC de repos. Chacune a besoin de sa donnée
          ci-dessus.
        </p>
      </div>

      {state?.error && (
        <p className="col-span-2 text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      {state?.ok && (
        <p className="col-span-2 text-sm font-medium text-pine">Enregistré.</p>
      )}
      <SubmitButton className="col-span-2 py-2.5">Enregistrer</SubmitButton>
    </form>
  );
}
