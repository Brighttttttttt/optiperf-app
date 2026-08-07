import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, StatTile, StatusBadge } from "@/components/ui";
import { ObjectiveForm } from "@/components/ObjectiveForm";
import { RemoveAthleteButton } from "@/components/RemoveAthleteButton";
import { ZoneBar } from "@/components/ZoneBar";
import { RecordsForm } from "@/components/RecordsForm";
import { deleteObjective } from "@/app/(app)/actions";
import { computeMetrics } from "@/lib/metrics";
import { addDays, formatDuration, toISODate } from "@/lib/dates";
import { additionnerZones, repartitionZones, type RepartitionZones } from "@/lib/zones";
import type {
  Activity,
  ActivityTrace,
  Objective,
  PersonalRecord,
  Profile,
  TrainingSession,
} from "@/lib/types";

const ZONES_VIDES: RepartitionZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

export default async function AthleteFichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();

  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!athlete) redirect("/");

  const [sessionsRes, objectivesRes, recordsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", id)
      .gte("date", toISODate(addDays(now, -27)))
      .lte("date", toISODate(now))
      .order("date"),
    supabase
      .from("objectives")
      .select("*")
      .eq("athlete_id", id)
      .order("target_date", { ascending: true }),
    supabase.from("personal_records").select("*").eq("athlete_id", id),
  ]);

  const sessions = (sessionsRes.data ?? []) as TrainingSession[];
  const objectives = (objectivesRes.data ?? []) as Objective[];
  const records = (recordsRes.data ?? []) as PersonalRecord[];
  const metrics = computeMetrics(sessions, now);

  // Moyenne des zones sur les 10 dernières séances rapportées, pas sur la
  // fenêtre de 28 jours ci-dessus : un athlète qui s'entraîne peu doit
  // pouvoir remonter plus loin pour ses 10 dernières.
  let zonesMoyennes: RepartitionZones | null = null;
  if (athlete.fc_max) {
    const { data: dernieresSeances } = await supabase
      .from("sessions")
      .select("id")
      .eq("athlete_id", id)
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(10);
    const sessionIds = (dernieresSeances ?? []).map((s) => s.id);

    if (sessionIds.length > 0) {
      const { data: activitesLiees } = await supabase
        .from("activities")
        .select("id, session_id")
        .in("session_id", sessionIds)
        .order("started_at", { ascending: false });

      // Une séance peut agréger plusieurs activités : la plus récente la
      // représente, comme dans l'historique et la fiche de la séance.
      const activiteIdBySession = new Map<string, string>();
      for (const a of (activitesLiees ?? []) as Pick<Activity, "id" | "session_id">[]) {
        if (a.session_id && !activiteIdBySession.has(a.session_id)) {
          activiteIdBySession.set(a.session_id, a.id);
        }
      }
      const activiteIds = [...activiteIdBySession.values()];

      if (activiteIds.length > 0) {
        const { data: traces } = await supabase
          .from("activity_traces")
          .select("t_s, heart_rate")
          .in("activity_id", activiteIds);

        const fcMax = athlete.fc_max;
        zonesMoyennes = ((traces ?? []) as Pick<ActivityTrace, "t_s" | "heart_rate">[]).reduce(
          (acc, t) => additionnerZones(acc, repartitionZones(t.t_s, t.heart_rate ?? [], fcMax)),
          ZONES_VIDES
        );
      }
    }
  }

  return (
    <div className="px-5 space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-soft">
            7 derniers jours
          </p>
          <StatusBadge status={metrics.status} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <StatTile
            value={metrics.weeklyVolumeMin > 0 ? formatDuration(metrics.weeklyVolumeMin) : "0"}
            label="Volume"
          />
          <StatTile
            value={metrics.adherencePct !== null ? `${metrics.adherencePct} %` : "—"}
            label="Adhérence"
          />
          <StatTile
            value={metrics.avgRpe !== null ? String(metrics.avgRpe) : "—"}
            label="RPE moyen"
          />
          <StatTile value={String(Math.round(metrics.weeklyLoad))} label="Charge" />
        </div>
      </Card>

      {zonesMoyennes && (
        <Card className="p-4">
          <ZoneBar titre="Zones (10 dernières séances)" zones={zonesMoyennes} />
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">Records personnels</p>
          {/* La VMA est saisie par l'athlète seul (comme FC max) : le coach
              la consulte ici, il ne la modifie pas. */}
          <p className="text-[13px] text-ink-soft">
            VMA {athlete.vma_kmh !== null ? `${athlete.vma_kmh} km/h` : "—"}
          </p>
        </div>
        <div className="mt-2">
          <RecordsForm athleteId={athlete.id} records={records} />
        </div>
      </Card>

      <section>
        <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
          Objectifs
        </h2>
        <div className="space-y-2">
          {objectives.map((o) => (
            <Card key={o.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{o.title}</p>
                {o.target_date && (
                  <p className="text-[13px] text-ink-soft">
                    {new Date(`${o.target_date}T12:00:00`).toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </p>
                )}
              </div>
              <form action={deleteObjective}>
                <input type="hidden" name="objective_id" value={o.id} />
                <button
                  type="submit"
                  className="text-[13px] font-semibold text-ink-soft hover:text-rpe-max"
                >
                  Retirer
                </button>
              </form>
            </Card>
          ))}
          <ObjectiveForm athleteId={athlete.id} />
        </div>
      </section>

      <section className="pt-2">
        <RemoveAthleteButton
          athleteId={athlete.id}
          athleteName={athlete.full_name}
        />
      </section>
    </div>
  );
}
