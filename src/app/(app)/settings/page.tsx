import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { getViewMode } from "@/lib/view-mode";
import { Card, PageHeader } from "@/components/ui";
import { InviteCode } from "@/components/InviteCode";
import { LinkCoachForm } from "@/components/LinkCoachForm";
import { NameForm } from "@/components/NameForm";
import { HeartRateRefsForm } from "@/components/HeartRateRefsForm";
import { VmaForm } from "@/components/VmaForm";
import { RecordsForm } from "@/components/RecordsForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { TemplateList } from "@/components/TemplateList";
import type { PersonalRecord, SessionTemplate } from "@/lib/types";
import { signOut } from "@/app/(auth)/actions";
import { initials } from "@/lib/initials";
import type { Profile } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const profile = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  // Les réglages suivent le mode d'affichage : un coach qui s'entraîne a
  // besoin de sa FC max, de sa VMA et de ses records — pas de son code
  // d'invitation ni de ses modèles de séance, qui ne servent qu'à encadrer.
  const mode = await getViewMode();

  let templates: SessionTemplate[] = [];
  if (mode === "coach") {
    const { data } = await supabase
      .from("session_templates")
      .select("*")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false });
    templates = (data ?? []) as SessionTemplate[];
  }

  let coach: Profile | null = null;
  let records: PersonalRecord[] = [];
  if (mode === "athlete") {
    const { data: link } = await supabase
      .from("coach_athletes")
      .select("coach_id")
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (link) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", link.coach_id)
        .maybeSingle();
      coach = (data as Profile) ?? null;
    }

    const { data: recordsData } = await supabase
      .from("personal_records")
      .select("*")
      .eq("athlete_id", user.id);
    records = (recordsData ?? []) as PersonalRecord[];
  }

  return (
    <div>
      <PageHeader
        eyebrow={mode === "coach" ? "Compte coach" : "Compte athlète"}
        title="Réglages"
      />
      <div className="px-5 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="size-12 shrink-0 rounded-full bg-pine-soft text-pine font-display font-semibold flex items-center justify-center">
              {initials(profile.full_name)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold truncate">{profile.full_name}</p>
              <p className="text-[13px] text-ink-soft">{user.email}</p>
            </div>
          </div>
          <div className="mt-4">
            <NameForm currentName={profile.full_name} />
          </div>
        </Card>

        {mode === "coach" && profile.invite_code && (
          <InviteCode code={profile.invite_code} />
        )}

        {mode === "coach" && <TemplateList templates={templates} />}

        {mode === "athlete" && (
          <Card className="p-4">
            <p className="font-semibold">Fréquence cardiaque</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Sert de base au calcul des zones sur tes séances importées.
            </p>
            <div className="mt-3">
              <HeartRateRefsForm
                fcMax={profile.fc_max}
                fcRepos={profile.fc_repos}
                lthr={profile.lthr}
                methode={profile.zone_method}
              />
            </div>
          </Card>
        )}

        {mode === "athlete" && (
          <Card className="p-4">
            <p className="font-semibold">Records personnels</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Un chrono par distance : la nouvelle valeur remplace l&apos;ancienne.
            </p>
            <div className="mt-2">
              <RecordsForm athleteId={user.id} records={records} />
            </div>
          </Card>
        )}

        {mode === "athlete" && (
          <Card className="p-4">
            <p className="font-semibold">VMA</p>
            <div className="mt-3">
              <VmaForm vmaKmh={profile.vma_kmh} />
            </div>
          </Card>
        )}

        {mode === "athlete" && (
          <Card className="p-4">
            <p className="font-semibold">Mon coach</p>
            {coach ? (
              <p className="mt-0.5 text-[13px] text-ink-soft">
                Tu es entraîné par{" "}
                <span className="font-semibold text-ink">{coach.full_name}</span>.
                Pour changer de coach, saisis un nouveau code.
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-ink-soft">
                Saisis le code partagé par ton coach pour recevoir ton planning.
              </p>
            )}
            <LinkCoachForm />
          </Card>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-xl border border-line bg-card px-4 py-3 font-semibold text-ink transition-colors hover:border-pine/50"
          >
            Se déconnecter
          </button>
        </form>

        <DeleteAccount role={profile.role} />

        <p className="text-center text-[12px] text-ink-soft pb-2">
          Optiperf · V1
        </p>
      </div>
    </div>
  );
}
