-- ============================================================
-- Optiperf — records personnels et VMA
-- À exécuter dans l'éditeur SQL Supabase, après 011.
-- ============================================================
--
-- VMA sur le profil (comme fc_max/fc_repos, 010) : une valeur de référence,
-- pas un historique. Saisie par l'athlète seul — le coach la consulte, comme
-- FC max, sans la modifier.
--
-- Les records vivent dans une table à part, contrairement à la VMA : ils
-- sont saisis par l'athlète OU son coach (à la différence de FC max/VMA),
-- même règle que `objectives`. Un par distance et par athlète — un record
-- « se met à jour facilement quand il est battu » veut dire une ligne
-- remplacée, pas un historique empilé ; qui veut retracer une progression
-- s'appuierait sur autre chose qu'un record personnel.

alter table public.profiles
  add column vma_kmh real check (vma_kmh is null or vma_kmh between 8 and 26);

-- Défense en profondeur (comme fc_max/fc_repos, 010) : sans cette ligne, la
-- RLS laisserait passer une écriture que les privilèges par colonne de 001
-- (UPDATE restreint à full_name) refuseraient quand même.
grant update (vma_kmh) on table public.profiles to authenticated;

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  distance text not null check (distance in ('5km', '10km', 'semi', 'marathon')),
  duration_sec int not null check (duration_sec > 0 and duration_sec < 24 * 3600),
  achieved_on date,
  updated_at timestamptz not null default now(),

  unique (athlete_id, distance)
);

alter table public.personal_records enable row level security;

-- ============ RLS : comme `objectives` (001), pas comme `activities` ============
-- L'athlète et son coach lisent et écrivent tous les deux — un record n'est
-- pas un compte rendu réservé à l'athlète.

create policy "personal_records_select" on public.personal_records for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "personal_records_insert" on public.personal_records for insert to authenticated
  with check (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "personal_records_update" on public.personal_records for update to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id))
  with check (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "personal_records_delete" on public.personal_records for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

-- ============ Droits SQL : le premier des deux verrous ============

grant select, insert, update, delete on public.personal_records to authenticated;
grant all on public.personal_records to service_role;

revoke all on public.personal_records from anon;
