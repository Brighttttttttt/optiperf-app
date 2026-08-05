-- ============================================================
-- Optiperf — durcissement (issues #13, #14, #15)
-- À exécuter dans l'éditeur SQL Supabase, après 001_init.sql
-- ============================================================

-- ============ 1. LIMITES DE LONGUEUR ============
-- Empêche un client malveillant de stocker des mégaoctets de texte.

alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) between 1 and 80);

alter table public.objectives
  add constraint objectives_title_len check (char_length(title) between 1 and 120),
  add constraint objectives_notes_len check (notes is null or char_length(notes) <= 2000);

alter table public.sessions
  add constraint sessions_title_len check (char_length(title) between 1 and 120),
  add constraint sessions_description_len check (description is null or char_length(description) <= 4000),
  add constraint sessions_comment_len check (athlete_comment is null or char_length(athlete_comment) <= 4000),
  add constraint sessions_type_len check (char_length(type) <= 40);

-- ============ 2. SÉANCE LIBRE : coach_id OBLIGATOIREMENT NULL ============
-- Un athlète ne doit pas pouvoir forger une séance « planifiée par le
-- coach » et fausser ainsi sa propre adhérence.

drop policy "sessions_insert" on public.sessions;

create policy "sessions_insert" on public.sessions for insert to authenticated
  with check (
    -- le coach planifie pour un de ses athlètes
    (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id))
    -- ou l'athlète enregistre une séance libre, sans coach attribué
    or (athlete_id = (select auth.uid()) and coach_id is null)
  );

-- ============ 3. SÉPARATION PRESCRIPTION / RÉALISÉ ============
-- Le coach prescrit (titre, type, consignes, durée prévue, date) ;
-- l'athlète rapporte (statut, RPE, durée réelle, commentaire).
-- Chacun garde la main sur sa moitié : le coach ne réécrit pas le
-- ressenti de l'athlète, l'athlète ne réécrit pas la consigne du coach.

create or replace function public.enforce_session_ownership()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_athlete boolean := (old.athlete_id = v_uid);
  v_prescribed boolean := (old.coach_id is not null);
begin
  -- Les scripts d'administration (seed) n'ont pas d'utilisateur : on passe.
  if v_uid is null then
    return new;
  end if;

  if v_is_athlete then
    -- L'athlète ne touche pas à la prescription d'une séance de coach.
    if v_prescribed and (
      new.title is distinct from old.title
      or new.type is distinct from old.type
      or new.description is distinct from old.description
      or new.duration_planned_min is distinct from old.duration_planned_min
      or new.date is distinct from old.date
      or new.coach_id is distinct from old.coach_id
    ) then
      raise exception 'Cette séance est prescrite par ton coach : tu ne peux modifier que ton compte rendu.';
    end if;
  else
    -- Le coach ne touche pas au compte rendu de l'athlète.
    if new.rpe is distinct from old.rpe
      or new.duration_actual_min is distinct from old.duration_actual_min
      or new.athlete_comment is distinct from old.athlete_comment
      or new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
    then
      raise exception 'Le compte rendu appartient à l''athlète : il ne peut pas être modifié par le coach.';
    end if;
  end if;

  -- L'athlète d'une séance ne change jamais.
  if new.athlete_id is distinct from old.athlete_id then
    raise exception 'Une séance ne peut pas changer d''athlète.';
  end if;

  return new;
end;
$$;

create trigger enforce_session_ownership_trigger
  before update on public.sessions
  for each row execute function public.enforce_session_ownership();

-- ============ 4. SUPPRESSION DE SON PROPRE COMPTE (RGPD) ============
-- Les cascades du schéma 001 effacent profil, séances, objectifs,
-- messages, notifications et liaisons.

create or replace function public.delete_own_account()
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Aucune session active.';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
