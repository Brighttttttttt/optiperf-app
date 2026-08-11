-- ============================================================
-- Optiperf — un coach peut aussi s'entraîner (issue #62)
-- À exécuter dans l'éditeur SQL du projet Supabase
-- ============================================================
--
-- Le reste du schéma était déjà prêt, et c'est le résultat le plus utile de
-- cette migration : rien d'autre à changer.
--
--   * `enforce_session_ownership` (002) tranche déjà **par séance**, pas par
--     personne : `v_is_athlete := (old.athlete_id = v_uid)`. Un compte qui
--     tient les deux rôles est donc l'athlète de ses propres séances et le
--     coach de celles qu'il prescrit, sans rien y toucher.
--   * `sessions_insert` (001) autorise déjà `athlete_id = auth.uid()` : un
--     coach pouvait techniquement se créer des séances, seule l'interface
--     ne le lui proposait pas.
--   * `is_my_athlete` / `is_my_coach` (001) sont `security definer` et font
--     une lecture à un seul niveau dans `coach_athletes` — elles ne
--     s'appellent pas l'une l'autre, donc aucun risque de récursion quand
--     un même compte apparaît des deux côtés de la table.
--
-- Ne restait que `link_to_coach`, qui refusait explicitement un non-athlète.

create or replace function public.link_to_coach(code text)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  select id into v_coach
  from public.profiles
  where role = 'coach' and invite_code = upper(trim(code));

  if v_coach is null then
    raise exception 'Code d''invitation invalide.';
  end if;

  -- Le seul enchaînement à interdire. Une liaison sur soi-même rendrait
  -- `is_my_athlete(soi)` vrai, ce qui élargirait silencieusement toutes les
  -- politiques écrites en « moi **ou** mes athlètes ».
  --
  -- Deux coachs qui se suivent l'un l'autre restent en revanche permis :
  -- c'est un cas réel entre partenaires d'entraînement, et les deux
  -- fonctions de visibilité lisant `coach_athletes` à un seul niveau, la
  -- réciprocité n'ouvre l'accès à rien de plus qu'une liaison ordinaire.
  if v_coach = auth.uid() then
    raise exception 'On ne peut pas être son propre coach.';
  end if;

  insert into public.coach_athletes (coach_id, athlete_id)
  values (v_coach, auth.uid())
  on conflict (athlete_id) do update set coach_id = excluded.coach_id;
end;
$$;
