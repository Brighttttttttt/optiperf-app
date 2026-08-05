import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { Card, PageHeader } from "@/components/ui";
import { InviteCode } from "@/components/InviteCode";
import { LinkCoachForm } from "@/components/LinkCoachForm";
import { NameForm } from "@/components/NameForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { TemplateList } from "@/components/TemplateList";
import type { SessionTemplate } from "@/lib/types";
import { signOut } from "@/app/(auth)/actions";
import { initials } from "@/lib/initials";
import type { Profile } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const profile = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  let templates: SessionTemplate[] = [];
  if (profile.role === "coach") {
    const { data } = await supabase
      .from("session_templates")
      .select("*")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false });
    templates = (data ?? []) as SessionTemplate[];
  }

  let coach: Profile | null = null;
  if (profile.role === "athlete") {
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
  }

  return (
    <div>
      <PageHeader
        eyebrow={profile.role === "coach" ? "Compte coach" : "Compte athlète"}
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

        {profile.role === "coach" && profile.invite_code && (
          <InviteCode code={profile.invite_code} />
        )}

        {profile.role === "coach" && <TemplateList templates={templates} />}

        {profile.role === "athlete" && (
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
