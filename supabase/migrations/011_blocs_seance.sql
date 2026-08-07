-- ============================================================
-- Optiperf — structurer une séance running en blocs
-- À exécuter dans l'éditeur SQL Supabase, après 010.
-- ============================================================
--
-- Le texte libre de `sessions.description` reste le repli pour une séance
-- simple ; les blocs s'ajoutent pour une séance structurée (fractionné
-- notamment) sans rien retirer à l'existant.
--
-- Prescription, pas compte rendu : un bloc se lit comme `description` ou
-- `duration_planned_min`, pas comme `rpe` ou `athlete_comment`. La séparation
-- coach/athlète du trigger `enforce_session_ownership` (002) porte sur les
-- colonnes de `sessions` ; ici, sur une table à part, elle est reproduite en
-- RLS — avec une nuance que `sessions` n'a pas : les blocs deviennent
-- immuables dès que la séance quitte le statut « planned », pour la même
-- raison qu'un coach ne réécrit pas le compte rendu après coup. Comme ce
-- statut change dans le temps, la policy interroge `sessions` en direct
-- plutôt que de dupliquer une donnée qui se périmerait.

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  -- Ordre d'exécution, pas un id de tri : 0, 1, 2… sans trou après une
  -- suppression, recalculé par l'application à chaque enregistrement.
  position int not null check (position >= 0),
  block_type text not null check (
    block_type in ('echauffement', 'intervalle', 'recuperation', 'retour_calme')
  ),
  duration_sec int check (duration_sec is null or duration_sec > 0),
  distance_m int check (distance_m is null or distance_m > 0),
  target_pace_sec_per_km int check (
    target_pace_sec_per_km is null or target_pace_sec_per_km between 120 and 1800
  ),
  repetitions int check (repetitions is null or repetitions between 1 and 50),

  created_at timestamptz not null default now(),

  unique (session_id, position),
  constraint workout_blocks_duree_ou_distance
    check (duration_sec is not null or distance_m is not null)
);

create index workout_blocks_session_idx on public.workout_blocks (session_id);

alter table public.workout_blocks enable row level security;

-- ============ RLS ============

create policy "workout_blocks_select" on public.workout_blocks for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = workout_blocks.session_id
        and (s.athlete_id = (select auth.uid()) or public.is_my_athlete(s.athlete_id))
    )
  );

-- Qui prescrit peut écrire, et seulement tant que la séance reste planifiée :
-- le coach pour une séance qu'il a prescrite à l'un de ses athlètes, sinon
-- l'athlète pour sa propre séance libre (coach_id null) — même distinction
-- que `sessions_insert` (001).
create policy "workout_blocks_insert" on public.workout_blocks for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = workout_blocks.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

create policy "workout_blocks_update" on public.workout_blocks for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = workout_blocks.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = workout_blocks.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

create policy "workout_blocks_delete" on public.workout_blocks for delete to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = workout_blocks.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans les lignes qui suivent, le visiteur non
-- connecté disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, update, delete on public.workout_blocks to authenticated;
grant all on public.workout_blocks to service_role;

revoke all on public.workout_blocks from anon;
