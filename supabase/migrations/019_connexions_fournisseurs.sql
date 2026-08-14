-- ============================================================
-- Optiperf — connexions aux fournisseurs d'activités (Strava, Garmin, Coros)
-- À exécuter dans l'éditeur SQL Supabase, après 018.
-- ============================================================
--
-- L'athlète autorise Optiperf à lire son compte chez un fournisseur. Cette
-- migration ne porte que **le lien de compte** : aucune activité n'est
-- synchronisée à ce stade (#105).
--
-- Table **générique dès le départ** plutôt qu'une table par fournisseur :
-- Garmin et Coros suivront, et trois tables identiques à une colonne près
-- feraient trois fois le même travail de RLS et de droits — le meilleur moyen
-- d'en oublier un.
--
-- ============ Ce que le coach voit : rien ============
--
-- Aucune politique ne lui est écrite. Une table protégée sans politique ne
-- rend rien : l'invisibilité tient à une **absence**, comme pour `coach_notes`
-- (015). Ce n'est pas un détail de confort — les conditions d'API de Strava
-- interdisent d'exposer les données d'un athlète à un tiers, et la première
-- des données est le fait même qu'il ait un compte chez eux.
--
-- ============ Les jetons ============
--
-- Ils arrivent ici **déjà chiffrés** par l'application (AES-GCM,
-- `src/lib/chiffrement.ts`, clé `PROVIDER_TOKEN_KEY` qui ne vit que côté
-- serveur). La base ne voit que du binaire encodé.
--
-- C'est ce chiffrement, et non les droits SQL, qui protège le jeton de
-- renouvellement : l'application tourne sous le rôle `authenticated` de
-- l'utilisateur — elle n'a pas d'autre identité — donc tout droit de lecture
-- qu'on lui donne, un XSS l'obtient aussi. Un XSS lit désormais un bloc
-- inexploitable sans une clé qui n'a jamais quitté le serveur.
--
-- Corollaire à ne pas perdre : **changer `PROVIDER_TOKEN_KEY` invalide toutes
-- les connexions existantes.** Les athlètes devront se reconnecter. Rien ne
-- casse, mais rien ne se répare non plus.

create table public.provider_connections (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'coros')),

  -- L'identifiant de l'athlète chez le fournisseur : c'est lui qui permettra
  -- de rapprocher une activité entrante du bon compte.
  external_athlete_id text not null,

  -- Chiffrés côté application. Jamais lisibles en clair, même par le
  -- propriétaire de la ligne.
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,

  -- Les autorisations effectivement accordées : Strava laisse l'athlète en
  -- décocher au moment d'autoriser, et une synchronisation qui suppose un
  -- droit refusé échouerait sans qu'on sache pourquoi.
  scope text,

  connected_at timestamptz not null default now(),

  -- Une connexion par athlète et par fournisseur. Se reconnecter remplace la
  -- précédente plutôt que d'en empiler une seconde.
  primary key (athlete_id, provider)
);

alter table public.provider_connections enable row level security;

-- ============ RLS : l'athlète, et lui seul ============

create policy "provider_connections_select" on public.provider_connections
  for select to authenticated
  using (athlete_id = (select auth.uid()));

create policy "provider_connections_insert" on public.provider_connections
  for insert to authenticated
  with check (athlete_id = (select auth.uid()));

create policy "provider_connections_update" on public.provider_connections
  for update to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));

-- Se déconnecter est un droit, pas une faveur.
create policy "provider_connections_delete" on public.provider_connections
  for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans ces lignes, le visiteur non connecté
-- disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, update, delete on public.provider_connections to authenticated;
grant all on public.provider_connections to service_role;

revoke all on public.provider_connections from anon;
