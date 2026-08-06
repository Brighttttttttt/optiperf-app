"use client";

import { useActionState, useRef, useState } from "react";
import { importActivity } from "@/app/(app)/actions";
import { RpeScale } from "./RpeScale";
import { SubmitButton } from "./SubmitButton";
import { IconPlus } from "./Icons";
import { btnGhost, inputClass, labelClass } from "@/lib/styles";
import { LIMITS, SESSION_TYPES, type TrainingSession } from "@/lib/types";
import {
  empreinteFichier,
  formatDistance,
  lireFichierActivite,
  type ActiviteLue,
} from "@/lib/activites";
import { formatDayLong, formatDuration } from "@/lib/dates";

type Lue = ActiviteLue & { externalId: string; fileName: string };

/** Rattachement à aucune séance existante. Le serveur le traite comme absent. */
const NOUVELLE = "nouvelle";

/**
 * Dépôt d'un fichier de montre.
 *
 * Le fichier est lu **par le navigateur** : l'athlète voit ce qui en a été
 * tiré avant de valider, et plusieurs mégaoctets n'ont pas à traverser le
 * réseau. Ne part au serveur que ce qui est affiché ici.
 */
export function ImportActivitySheet({ sessions }: { sessions: TrainingSession[] }) {
  const [open, setOpen] = useState(false);
  const [lue, setLue] = useState<Lue | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [seance, setSeance] = useState("");
  const champFichier = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState(importActivity, null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) fermer();
  }

  function fermer() {
    setOpen(false);
    setLue(null);
    setErreurLecture(null);
    setRpe(null);
    setSeance("");
  }

  async function analyser(fichier: File | undefined) {
    setErreurLecture(null);
    setLue(null);
    // Un autre fichier, un autre jour : les candidates au rattachement
    // changent, le choix précédent n'a plus de sens.
    setSeance("");
    if (!fichier) return;

    const contenu = await fichier.text();
    const lecture = lireFichierActivite(contenu, fichier.name);
    if (!lecture.ok) {
      setErreurLecture(lecture.erreur);
      return;
    }
    setLue({
      ...lecture.activite,
      externalId: await empreinteFichier(contenu),
      fileName: fichier.name.slice(0, LIMITS.fileName),
    });
  }

  // Les séances de ce jour-là, seules candidates au rattachement.
  const candidates = lue ? sessions.filter((s) => s.date === lue.date) : [];
  // Une seule : proposée d'emblée. Plusieurs : à l'athlète de dire laquelle,
  // lui seul sait ce qu'il a fait — la valeur vide de l'option d'invite reste
  // alors en place, et `required` empêche d'enregistrer sans avoir choisi.
  // « Nouvelle séance » porte donc une valeur propre : deux options vides
  // rendraient ce choix légitime indistinguable de l'absence de choix.
  const defaut =
    candidates.length === 1 ? candidates[0].id : candidates.length === 0 ? NOUVELLE : "";
  const seanceChoisie = seance || defaut;
  const nouvelleSeance = seanceChoisie === NOUVELLE;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnGhost} w-full py-3`}
      >
        <IconPlus className="size-4" />
        Importer un fichier de montre
      </button>
    );
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <p className="font-display text-[18px] font-semibold uppercase tracking-wide">
        Importer une séance
      </p>

      <div className="mt-3">
        <label className={labelClass} htmlFor="import-fichier">
          Fichier exporté de ta montre (GPX ou TCX)
        </label>
        <input
          ref={champFichier}
          id="import-fichier"
          type="file"
          accept=".gpx,.tcx,application/gpx+xml"
          onChange={(e) => analyser(e.target.files?.[0])}
          className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-pine-soft file:px-3 file:py-1.5 file:text-pine file:font-semibold`}
        />
        {erreurLecture && (
          <p className="mt-2 text-sm font-medium text-rpe-max">{erreurLecture}</p>
        )}
      </div>

      {lue && (
        <form action={action} className="mt-4 space-y-3.5">
          {/* Ce que le fichier a donné : l'athlète le voit avant d'enregistrer. */}
          <div className="rounded-xl bg-surface p-3">
            <p className="text-[13px] font-semibold text-pine">
              {formatDayLong(lue.date)}
            </p>
            <p className="mt-1 text-[15px]">
              {formatDuration(lue.durationMin)}
              {lue.distanceM !== null && ` · ${formatDistance(lue.distanceM)}`}
              {lue.avgHeartRate !== null && ` · ${lue.avgHeartRate} bpm`}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-soft truncate">{lue.fileName}</p>
          </div>

          <input type="hidden" name="external_id" value={lue.externalId} />
          <input type="hidden" name="file_name" value={lue.fileName} />
          <input type="hidden" name="started_at" value={lue.startedAt} />
          <input type="hidden" name="date" value={lue.date} />
          <input type="hidden" name="duration_min" value={lue.durationMin} />
          <input type="hidden" name="distance_m" value={lue.distanceM ?? ""} />
          <input type="hidden" name="avg_heart_rate" value={lue.avgHeartRate ?? ""} />

          {candidates.length > 0 && (
            <div>
              <label className={labelClass} htmlFor="import-seance">
                Rattacher à
              </label>
              <select
                id="import-seance"
                name="session_id"
                required
                value={seanceChoisie}
                onChange={(e) => setSeance(e.target.value)}
                className={inputClass}
              >
                {candidates.length > 1 && (
                  <option value="" disabled>
                    Choisis la séance
                  </option>
                )}
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
                <option value={NOUVELLE}>Aucune — nouvelle séance</option>
              </select>
            </div>
          )}

          {nouvelleSeance && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelClass} htmlFor="import-titre">
                  Titre
                </label>
                <input
                  id="import-titre"
                  name="title"
                  required
                  maxLength={LIMITS.title}
                  defaultValue={
                    lue.distanceM !== null
                      ? `Sortie ${formatDistance(lue.distanceM)}`
                      : "Séance importée"
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="import-type">
                  Type
                </label>
                <select id="import-type" name="type" className={inputClass}>
                  {SESSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            {/* La seule chose qu'aucune montre ne mesure. */}
            <span className={labelClass}>Effort ressenti (RPE)</span>
            <RpeScale value={rpe} onChange={setRpe} />
            <input type="hidden" name="rpe" value={rpe ?? ""} />
          </div>

          <div>
            <label className={labelClass} htmlFor="import-comment">
              Analyse de séance
            </label>
            <textarea
              id="import-comment"
              name="athlete_comment"
              rows={2}
              maxLength={LIMITS.comment}
              placeholder="Sensations, contexte…"
              className={inputClass}
            />
          </div>

          {state?.error && (
            <p className="text-sm font-medium text-rpe-max">{state.error}</p>
          )}

          <div className="flex gap-2">
            <SubmitButton className="flex-1 py-2.5">Enregistrer</SubmitButton>
            <button type="button" onClick={fermer} className={btnGhost}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {!lue && (
        <button type="button" onClick={fermer} className={`${btnGhost} mt-3 w-full`}>
          Annuler
        </button>
      )}
    </div>
  );
}
