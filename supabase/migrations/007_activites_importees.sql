-- ============================================================
-- Optiperf — activités importées d'une montre
-- À exécuter dans l'éditeur SQL Supabase, après 006.
-- ============================================================
--
-- Une activité est ce qu'une montre a enregistré ; une séance est ce qui a
-- été prescrit ou rapporté. Les deux ne coïncident pas toujours :
--
--   * une activité peut n'être rattachée à aucune séance (sortie non prévue,
--     déposée avant que l'athlète ne saisisse quoi que ce soit) ;
--   * une séance peut en agréger plusieurs (deux sorties dans la journée).
--
-- D'où une table reliée plutôt que des colonnes sur `sessions` : le lien est
-- facultatif des deux côtés.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- Le lien vers la séance est facultatif, et sa disparition ne doit pas
  -- emporter l'activité : ce que la montre a mesuré reste vrai.
  session_id uuid references public.sessions (id) on delete set null,

  source text not null check (source in ('fichier', 'strava', 'garmin', 'coros')),
  -- Identifiant chez la source. Pour un fichier déposé, une empreinte de son
  -- contenu : c'est ce qui rend un second dépôt du même fichier détectable.
  external_id text not null check (char_length(external_id) between 1 and 200),
  file_name text check (file_name is null or char_length(file_name) <= 200),

  started_at timestamptz not null,
  -- Le jour vécu par l'athlète, calculé côté application (Europe/Paris forcé
  -- dans src/lib/dates.ts, Vercel tournant en UTC). C'est lui qui sert au
  -- rapprochement avec `sessions.date`, et non `started_at` : une sortie de
  -- 23 h 30 appartient à sa soirée, pas au lendemain UTC.
  date date not null,

  duration_min int not null check (duration_min > 0),
  distance_m int check (distance_m is null or distance_m >= 0),
  avg_heart_rate int check (avg_heart_rate is null or avg_heart_rate between 20 and 240),

  created_at timestamptz not null default now(),

  -- Anti-doublon, au niveau SQL et non applicatif : une vérification dans le
  -- code s'oublie au prochain point d'entrée, une contrainte non.
  --
  -- Portée à l'athlète, et non globale : deux athlètes ayant couru ensemble
  -- peuvent déposer le même fichier, et chacun doit garder le sien. Chez une
  -- source connectée, l'identifiant est de toute façon propre au compte.
  unique (athlete_id, source, external_id)
);

create index activities_athlete_date_idx
  on public.activities (athlete_id, date desc);
create index activities_session_idx
  on public.activities (session_id);

alter table public.activities enable row level security;

-- ============ RLS : qui voit quoi ============
-- Lecture : l'athlète et son coach, comme pour les séances.
-- Écriture : l'athlète seul.
--
-- C'est la même règle que celle du trigger `enforce_session_ownership`
-- (migration 002) : le compte rendu appartient à l'athlète. Une activité est
-- du compte rendu à l'état pur — ce que la montre a mesuré. Le coach la
-- consulte, il ne la corrige pas.

create policy "activities_select" on public.activities for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

create policy "activities_insert" on public.activities for insert to authenticated
  with check (athlete_id = (select auth.uid()));

create policy "activities_update" on public.activities for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

create policy "activities_delete" on public.activities for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans les lignes qui suivent, le visiteur non
-- connecté disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, update, delete on public.activities to authenticated;
grant all on public.activities to service_role;

revoke all on public.activities from anon;
