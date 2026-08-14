-- ============================================================
-- Optiperf — les tours d'une activité importée
-- À exécuter dans l'éditeur SQL Supabase, après 015.
-- ============================================================
--
-- Un tour est ce que la montre a enregistré entre deux bips : une répétition,
-- une récupération, un échauffement. C'est le découpage qui permet de dire
-- « 7×1km » plutôt que « 12,4 km », et donc au coach de voir si la séance
-- qu'il a prescrite a été tenue.
--
-- L'application lisait déjà ces tours (FIT et TCX) mais ne s'en servait que
-- pour additionner les totaux quand la session ne les donnait pas : la
-- structure était perdue à la lecture. C'est elle qu'on garde ici.
--
-- ============ Une ligne par tour, contrairement à la trace ============
--
-- `activity_traces` (009) tient dans une seule ligne par activité, avec des
-- tableaux parallèles, parce qu'un trail de 2 h échantillonné à la seconde
-- dépasserait 7000 lignes. Un tour n'a pas ce problème : une séance en compte
-- une vingtaine, un ultra à tour automatique une centaine. Une ligne par tour
-- se lit, se trie et se filtre en SQL ; des tableaux parallèles ne le
-- permettraient pas, et n'apporteraient rien à ce volume.
--
-- Le GPX n'a jamais de tours — c'est une liste de points. Une activité sans
-- ligne ici est donc normale, pas incomplète.

create table public.activity_laps (
  activity_id uuid not null references public.activities (id) on delete cascade,
  -- Dénormalisé depuis activities.athlete_id, comme pour activity_traces : une
  -- RLS simple plutôt qu'une sous-requête corrélée à chaque lecture. La clé
  -- étrangère composée ci-dessous interdit qu'il diverge.
  athlete_id uuid not null references public.profiles (id) on delete cascade,

  -- Rang dans la séance, tel que la montre l'a enregistré. Sert à l'ordre
  -- d'affichage et à l'analyse : sans lui, sept répétitions ne sont qu'un sac.
  position int not null check (position >= 0),

  duration_s int not null check (duration_s > 0),
  distance_m int check (distance_m is null or distance_m >= 0),
  avg_heart_rate int check (avg_heart_rate is null or avg_heart_rate between 20 and 240),
  avg_cadence int check (avg_cadence is null or avg_cadence between 0 and 300),

  created_at timestamptz not null default now(),

  -- La vitesse moyenne n'est pas stockée : elle se déduit exactement de la
  -- distance et de la durée. Une donnée dérivée en base est une donnée qui
  -- peut contredire celles dont elle vient.

  primary key (activity_id, position),

  constraint activity_laps_activity_athlete_fkey
    foreign key (activity_id, athlete_id)
    references public.activities (id, athlete_id)
    on delete cascade
);

create index activity_laps_athlete_idx on public.activity_laps (athlete_id);

alter table public.activity_laps enable row level security;

-- ============ RLS : la même visibilité que l'activité portée ============
-- Calquée sur `activity_traces` (009), pour la même raison : un tour décrit
-- l'activité, il se voit exactement comme elle — l'athlète et son coach.
--
-- Écriture par l'athlète seul, à l'import. Pas de policy `update` : un tour
-- ne se corrige pas après coup. Il se remplace en réimportant, ce que
-- l'anti-doublon de `activities` empêche de toute façon tant que l'activité
-- existe.

create policy "activity_laps_select" on public.activity_laps for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "activity_laps_insert" on public.activity_laps for insert to authenticated
  with check (athlete_id = (select auth.uid()));

create policy "activity_laps_delete" on public.activity_laps for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans les lignes qui suivent, le visiteur non
-- connecté disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, delete on public.activity_laps to authenticated;
grant all on public.activity_laps to service_role;

revoke all on public.activity_laps from anon;
