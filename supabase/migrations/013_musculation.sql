-- ============================================================
-- Optiperf — séances de musculation (exercices)
-- À exécuter dans l'éditeur SQL Supabase, après 012.
-- ============================================================
--
-- Même séparation prescription / compte rendu que le running (`sessions`,
-- trigger enforce_session_ownership de 002 ; `workout_blocks`, migration 011)
-- mais sur deux tables distinctes plutôt qu'une seule : la prescription
-- (combien de séries, de répétitions, quelle charge visée) et le réalisé
-- (ce qui a effectivement été fait) ne varient pas de la même façon dans le
-- temps — modifier la prescription après coup n'a pas de sens, modifier son
-- propre compte rendu si.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  position int not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 120),
  sets int not null check (sets between 1 and 20),
  reps int not null check (reps between 1 and 100),
  -- Nulle : exercice au poids du corps.
  charge_kg real check (charge_kg is null or charge_kg between 0 and 500),
  rest_sec int check (rest_sec is null or rest_sec between 0 and 1800),

  created_at timestamptz not null default now(),

  unique (session_id, position)
);

create index exercises_session_idx on public.exercises (session_id);

alter table public.exercises enable row level security;

-- RLS identique à `workout_blocks` (011) : qui prescrit écrit, seulement
-- tant que la séance reste planifiée. Voir son commentaire pour le détail.

create policy "exercises_select" on public.exercises for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = exercises.session_id
        and (s.athlete_id = (select auth.uid()) or public.is_my_athlete(s.athlete_id))
    )
  );

create policy "exercises_insert" on public.exercises for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = exercises.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

create policy "exercises_update" on public.exercises for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = exercises.session_id
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
      where s.id = exercises.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

create policy "exercises_delete" on public.exercises for delete to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = exercises.session_id
        and s.status = 'planned'
        and (
          (s.coach_id = (select auth.uid()) and public.is_my_athlete(s.athlete_id))
          or (s.coach_id is null and s.athlete_id = (select auth.uid()))
        )
    )
  );

-- ============================================================
-- Réalisé : le pendant muscu du couple description/athlete_comment du
-- running. `athlete_id` est dénormalisé (contrairement à `exercises`) : ce
-- n'est pas un statut qui change dans le temps qui décide de la
-- mutabilité ici, mais l'identité de l'athlète, stable — pas besoin d'une
-- jointure vive comme pour la prescription.

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null unique references public.exercises (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,

  sets_done int check (sets_done is null or sets_done between 0 and 20),
  reps_done int check (reps_done is null or reps_done between 0 and 100),
  charge_kg_done real check (charge_kg_done is null or charge_kg_done between 0 and 500),
  done boolean not null default false,
  athlete_comment text check (athlete_comment is null or char_length(athlete_comment) <= 2000),

  updated_at timestamptz not null default now()
);

create index exercise_logs_athlete_idx on public.exercise_logs (athlete_id);

alter table public.exercise_logs enable row level security;

-- Lecture : l'athlète et son coach, comme `activities`. Écriture : l'athlète
-- seul — c'est son compte rendu — et seulement pour un exercice de sa
-- propre séance (vérifié à l'insertion par une jointure, faute de pouvoir
-- répliquer une clé étrangère composée sans dupliquer athlete_id sur
-- `exercises` lui-même, qui n'en a pas besoin par ailleurs).

create policy "exercise_logs_select" on public.exercise_logs for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "exercise_logs_insert" on public.exercise_logs for insert to authenticated
  with check (
    athlete_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      join public.sessions s on s.id = e.session_id
      where e.id = exercise_logs.exercise_id and s.athlete_id = (select auth.uid())
    )
  );

create policy "exercise_logs_update" on public.exercise_logs for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

create policy "exercise_logs_delete" on public.exercise_logs for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============

grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.exercise_logs to authenticated;
grant all on public.exercises, public.exercise_logs to service_role;

revoke all on public.exercises from anon;
revoke all on public.exercise_logs from anon;
