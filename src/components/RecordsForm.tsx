"use client";

import { useActionState, useState } from "react";
import { saveRecord } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass } from "@/lib/styles";
import {
  estimerVma,
  formatDurationInput,
  parseDurationInput,
  recordDistanceLabel,
  RECORD_DISTANCES,
} from "@/lib/records";
import type { PersonalRecord } from "@/lib/types";

function RecordRow({
  athleteId,
  distance,
  record,
}: {
  athleteId: string;
  distance: string;
  record?: PersonalRecord;
}) {
  const [state, action] = useActionState(saveRecord, null);
  const [valeur, setValeur] = useState(record ? formatDurationInput(record.duration_sec) : "");
  const dureeSec = parseDurationInput(valeur);
  const suggestion = dureeSec !== null ? estimerVma(distance, dureeSec) : null;

  return (
    <form action={action} className="flex items-start gap-2.5 py-2.5 border-b border-line last:border-0">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <input type="hidden" name="distance" value={distance} />
      <span className="w-24 shrink-0 pt-2.5 text-[14px] font-semibold">
        {recordDistanceLabel(distance)}
      </span>
      <div className="flex-1 min-w-0">
        <input
          name="duration"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="mm:ss"
          className={`${inputClass} py-2`}
        />
        {suggestion !== null && (
          <p className="mt-1 text-[11px] text-ink-soft">VMA suggérée : {suggestion} km/h</p>
        )}
        {state?.error && (
          <p className="mt-1 text-[11px] font-medium text-rpe-max">{state.error}</p>
        )}
      </div>
      <SubmitButton className="shrink-0 px-3 py-2 text-[13px]">OK</SubmitButton>
    </form>
  );
}

/** Records par distance standard : une ligne par distance, se remplace quand elle est battue. */
export function RecordsForm({
  athleteId,
  records,
}: {
  athleteId: string;
  records: PersonalRecord[];
}) {
  return (
    <div>
      {RECORD_DISTANCES.map((d) => (
        <RecordRow
          key={d.value}
          athleteId={athleteId}
          distance={d.value}
          record={records.find((r) => r.distance === d.value)}
        />
      ))}
    </div>
  );
}
