-- ============================================================
-- Optiperf — trace (FC/allure/altitude) d'une activité importée
-- À exécuter dans l'éditeur SQL Supabase, après 008.
-- ============================================================
--
-- Revient sur le choix pris en 007 de ne stocker aucune trace ("l'app n'en
-- fait aujourd'hui aucun usage, et ne pas les stocker évite d'avoir à
-- décider qui peut les voir"). L'usage existe désormais (courbes de séance,
-- zones de fréquence cardiaque) ; la question d'accès est tranchée ici,
-- explicitement, plutôt que laissée par défaut : une trace se voit comme
-- l'activité qui la porte — l'athlète et son coach, jamais un autre athlète.
--
-- Une ligne par activité, pas une ligne par point : un trail de 2 h
-- échantillonné à la seconde dépasserait 7000 lignes pour une seule sortie,
-- sans rien apporter de plus lisible qu'une courbe déjà sous-échantillonnée
-- côté application (voir MAX_POINTS_TRACE dans src/lib/activites.ts, 400
-- points au maximum). Des tableaux parallèles suffisent et se relisent en
-- une seule ligne.

create table public.activity_traces (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  -- Dénormalisé depuis activities.athlete_id : une RLS simple, à l'identique
  -- des autres tables, plutôt qu'une sous-requête corrélée à chaque lecture.
  -- La contrainte composée ci-dessous garantit qu'il ne peut pas diverger de
  -- l'activité qu'il accompagne.
  athlete_id uuid not null references public.profiles (id) on delete cascade,

  -- Secondes écoulées depuis le début de l'activité, un point par échantillon
  -- — les quatre tableaux partagent leurs index.
  t_s integer[] not null,
  heart_rate integer[],
  pace_sec_per_km real[],
  altitude_m real[],

  created_at timestamptz not null default now(),

  constraint activity_traces_activity_athlete_fkey
    foreign key (activity_id, athlete_id)
    references public.activities (id, athlete_id)
    on delete cascade
);

-- Nécessaire à la clé étrangère composée ci-dessus : une activité ne change
-- pas d'athlète, cette contrainte ne fait qu'exposer ce qui est déjà vrai.
alter table public.activities
  add constraint activities_id_athlete_id_key unique (id, athlete_id);

alter table public.activity_traces enable row level security;

-- ============ RLS : la même visibilité que l'activité portée ============
-- Lecture : l'athlète et son coach. Écriture : l'athlète seul, à l'import —
-- une trace ne se corrige pas après coup, elle se remplace en réimportant
-- (bloqué de toute façon par l'anti-doublon de `activities`) : pas de policy
-- update.

create policy "activity_traces_select" on public.activity_traces for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "activity_traces_insert" on public.activity_traces for insert to authenticated
  with check (athlete_id = (select auth.uid()));

create policy "activity_traces_delete" on public.activity_traces for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans les lignes qui suivent, le visiteur non
-- connecté disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, delete on public.activity_traces to authenticated;
grant all on public.activity_traces to service_role;

revoke all on public.activity_traces from anon;
