import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { DeleteActivityButton } from "@/components/DeleteActivityButton";
import { formatDayLong, formatDuration } from "@/lib/dates";
import { formatDistance } from "@/lib/activites";
import { activitySourceLabel, type Activity, type TrainingSession } from "@/lib/types";

/**
 * Les fichiers déposés, pour eux-mêmes.
 *
 * Partout ailleurs, une activité ne se voit qu'à travers la séance qui la
 * porte. Ce lien étant facultatif des deux côtés (007), une activité pouvait
 * n'apparaître nulle part tout en occupant son empreinte de fichier, donc en
 * interdisant de le redéposer (#135). C'est l'écran qui manquait.
 *
 * Vue personnelle : on y lit ses propres dépôts. Le coach consulte ceux de ses
 * athlètes séance par séance, où la mesure éclaire le compte rendu — il n'a
 * rien à faire ici, la suppression n'appartenant qu'à l'athlète.
 */
export default async function ActivitesPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("athlete_id", profile.id)
    .order("started_at", { ascending: false })
    .limit(200);
  const activites = (data ?? []) as Activity[];

  // Le titre des séances rattachées, en une requête pour toute la liste —
  // même raison que `chargerDetailsSeances` : une par ligne rendrait la page
  // proportionnelle à l'historique.
  const idsSeances = [
    ...new Set(activites.map((a) => a.session_id).filter((id): id is string => id !== null)),
  ];
  const titres = new Map<string, string>();
  if (idsSeances.length > 0) {
    const { data: seances } = await supabase
      .from("sessions")
      .select("id, title")
      .in("id", idsSeances);
    for (const s of (seances ?? []) as Pick<TrainingSession, "id" | "title">[]) {
      titres.set(s.id, s.title);
    }
  }

  const orphelines = activites.filter((a) => a.session_id === null).length;

  return (
    <div>
      <PageHeader
        eyebrow={`${activites.length} fichier${activites.length > 1 ? "s" : ""}`}
        title="Importés"
        backHref="/history"
      />
      <div className="px-5 space-y-4">
        <p className="text-[13px] text-ink-soft">
          Ce que tes montres ont enregistré. Supprimer un relevé le rend à
          nouveau déposable ; la séance qu&apos;il documentait, elle, reste.
        </p>

        {orphelines > 0 && (
          <Card className="p-4">
            <p className="text-[14px] font-semibold">
              {orphelines === 1
                ? "1 relevé n'est rattaché à aucune séance"
                : `${orphelines} relevés ne sont rattachés à aucune séance`}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Leur séance a été supprimée depuis. Redéposer le fichier le
              rattachera à une nouvelle séance, sans créer de doublon.
            </p>
          </Card>
        )}

        {activites.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucun fichier importé"
              hint="Dépose un GPX, un TCX ou un FIT depuis l'accueil pour voir tes relevés ici."
            />
          </Card>
        ) : (
          <Card>
            {/* Une vraie liste : chaque relevé est un `listitem`, ce qui donne
                au lecteur d'écran le compte des éléments — et aux tests une
                prise stable, plutôt qu'un `div` filtré par son texte. */}
            <ul className="divide-y divide-line">
            {activites.map((a) => (
              <li key={a.id} className="p-4">
                {/* `flex-wrap` : la confirmation se déplie sur toute la
                    largeur plutôt que d'être compressée dans la colonne du
                    bouton. */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-pine">
                      {formatDayLong(a.date)}
                    </p>
                    <p className="mt-0.5 text-[15px]">
                      {formatDuration(a.duration_min)}
                      {a.distance_m !== null && ` · ${formatDistance(a.distance_m)}`}
                      {a.avg_heart_rate !== null && ` · ${a.avg_heart_rate} bpm`}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                      {activitySourceLabel(a.source)}
                      {a.file_name && ` · ${a.file_name}`}
                    </p>
                    {a.session_id ? (
                      <Link
                        href={`/seances/${a.session_id}` as never}
                        className="mt-1.5 inline-block text-[13px] font-semibold text-pine hover:underline"
                      >
                        {titres.get(a.session_id) ?? "Voir la séance"}
                      </Link>
                    ) : (
                      <p className="mt-1.5 text-[13px] font-semibold text-rpe-high">
                        Non rattaché
                      </p>
                    )}
                  </div>
                  <DeleteActivityButton
                    activityId={a.id}
                    rattachee={a.session_id !== null}
                  />
                </div>
              </li>
            ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
