-- ============================================================
-- Optiperf — consentement explicite aux données de santé
-- À exécuter dans l'éditeur SQL Supabase, après 019.
-- ============================================================
--
-- Optiperf traite des données de santé : fréquence cardiaque maximale et de
-- repos, seuil, VMA, effort ressenti, traces cardiaques, et jusqu'aux
-- blessures que le coach consigne dans ses notes.
--
-- Le RGPD les range dans les « catégories particulières » (article 9). Leur
-- traitement est **interdit par principe**, sauf exception — celle qui
-- s'applique ici étant le **consentement explicite** de la personne
-- (article 9.2.a).
--
-- Un consentement qui ne se date pas ne se prouve pas : d'où cette colonne
-- plutôt qu'un booléen. Elle répond à « quand », pas seulement à « oui ».

alter table public.profiles
  add column health_consent_at timestamptz;

comment on column public.profiles.health_consent_at is
  'Instant du consentement explicite au traitement des données de santé '
  '(RGPD art. 9.2.a). Null pour les comptes antérieurs à cette migration : '
  'ils sont invités à se prononcer à leur prochaine visite.';

-- ============ Qui peut l'écrire ============
--
-- Le privilège **par colonne**, comme pour toute colonne éditable de
-- `profiles` (001, complété par 010 et 012). L'oublier laisserait la RLS
-- accepter une écriture que Postgres refuserait quand même, en silence pour
-- l'utilisateur — le défaut rencontré deux fois sur FC max/repos puis sur la
-- VMA.
--
-- Chacun ne consent que pour soi : la policy `profiles_update` de 001 borne
-- déjà l'UPDATE à sa propre ligne.

grant update (health_consent_at) on public.profiles to authenticated;

-- ============ À l'inscription ============
--
-- Le profil naît d'un trigger sur `auth.users`, avant qu'une session
-- n'existe : la confirmation d'email étant activée, l'application ne peut
-- rien écrire dans `profiles` juste après l'inscription. Le consentement
-- voyage donc dans les métadonnées d'inscription, et c'est le trigger qui le
-- pose.
--
-- Le format est volontairement strict : seul un horodatage lisible est
-- retenu. Une valeur absente ou mal formée laisse la colonne nulle, ce qui
-- fait retomber le compte dans le cas « doit se prononcer » — jamais dans un
-- consentement supposé.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'athlete');
  v_consent timestamptz;
begin
  if v_role not in ('coach', 'athlete') then
    v_role := 'athlete';
  end if;

  -- `try_cast` n'existe pas en PL/pgSQL : on tente, et on abandonne la valeur
  -- plutôt que de faire échouer la création du compte.
  begin
    v_consent := (new.raw_user_meta_data ->> 'health_consent_at')::timestamptz;
  exception when others then
    v_consent := null;
  end;

  insert into public.profiles (id, role, full_name, invite_code, health_consent_at)
  values (
    new.id,
    v_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Utilisateur'),
    case when v_role = 'coach'
      then upper(substr(md5(gen_random_uuid()::text), 1, 6))
      else null
    end,
    v_consent
  );
  return new;
end;
$$;
