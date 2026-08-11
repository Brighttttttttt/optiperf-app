-- ============================================================
-- Optiperf — note libre du coach sur un athlète
-- À exécuter dans l'éditeur SQL Supabase, après 014.
-- ============================================================
--
-- Ce que le coach note sur quelqu'un et qui ne se rattache à rien : une
-- blessure passée, une contrainte d'emploi du temps, une préférence. Ni un
-- objectif (`objectives`, qui porte une échéance et que l'athlète voit), ni un
-- commentaire de séance.
--
-- ============ Pourquoi une table et non une colonne de `profiles` ============
--
-- La raison est une question d'écriture, pas de modélisation. `profiles`
-- n'accepte aujourd'hui d'UPDATE que de son propriétaire, colonne par colonne
-- (001, complété par 010 et 012). Y poser un champ écrit par quelqu'un d'autre
-- demanderait d'ouvrir la table aux écritures croisées, puis de reconstituer à
-- coups de trigger la garantie que le coach n'y touche que cette colonne —
-- exactement le dispositif que `sessions` a dû se payer (002).
--
-- Une table dont *toutes* les lignes appartiennent au coach n'a pas ce
-- problème : la RLS suffit, sans trigger.
--
-- ============ Une note par paire, et sa durée de vie ============
--
-- La clé est (coach, athlète) et non l'athlète seul : depuis 014 deux comptes
-- peuvent se coacher mutuellement, et chacun garde alors la sienne.
--
-- La clé étrangère pointe vers `coach_athletes` plutôt que deux fois vers
-- `profiles` : la note n'existe que tant que dure la relation de coaching. Un
-- coach qui retire un athlète de son groupe voit sa note disparaître avec le
-- lien, sans que l'application ait à y penser. Sans cela, la ligne survivrait
-- à la rupture du lien sans que personne ne puisse plus la lire ni l'effacer
-- (la RLS ci-dessous s'appuie sur ce lien), et reparaîtrait telle quelle si
-- l'athlète était réinvité des mois plus tard.

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  athlete_id uuid not null,

  content text not null check (char_length(content) between 1 and 2000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (coach_id, athlete_id),
  foreign key (coach_id, athlete_id)
    references public.coach_athletes (coach_id, athlete_id) on delete cascade
);

alter table public.coach_notes enable row level security;

-- ============ RLS : le coach seul, et personne d'autre ============
--
-- **L'athlète ne voit pas cette note.** C'est la question que l'issue #86
-- demandait de trancher explicitement, et voici la décision : une note dont
-- l'athlète serait lecteur n'est plus une note, c'est un message — or la
-- messagerie existe déjà, et le coach a `objectives` pour ce qui doit être
-- partagé. Un carnet que son auteur sait relu ne contient plus les
-- observations qui le rendent utile.
--
-- Conséquences assumées, à ne pas découvrir plus tard :
--   * ce n'est pas un endroit pour ce qu'on ne défendrait pas à voix haute —
--     l'invisibilité est une commodité d'écriture, pas un secret opposable ;
--   * la suppression du compte de l'athlète emporte le lien de coaching, donc
--     la note (cascade ci-dessus) ;
--   * le retrait de l'athlète du groupe l'emporte aussi.
--
-- Aucune politique n'est écrite pour l'athlète : sans politique, la RLS ne
-- laisse rien passer. C'est un silence délibéré.

create policy "coach_notes_select" on public.coach_notes for select to authenticated
  using (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id));

create policy "coach_notes_insert" on public.coach_notes for insert to authenticated
  with check (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id));

create policy "coach_notes_update" on public.coach_notes for update to authenticated
  using (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id))
  with check (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id));

-- La suppression ne demande pas le lien : un coach doit pouvoir effacer ce
-- qu'il a écrit même si la relation vient de s'interrompre. La cascade s'en
-- charge dans le cas courant, cette politique couvre le reste.
create policy "coach_notes_delete" on public.coach_notes for delete to authenticated
  using (coach_id = (select auth.uid()));

-- ============ Droits SQL : le premier des deux verrous ============
-- Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
-- toute table nouvellement créée. Sans les lignes qui suivent, le visiteur non
-- connecté disposerait d'un accès que seule la RLS retiendrait — voir 006.

grant select, insert, update, delete on public.coach_notes to authenticated;
grant all on public.coach_notes to service_role;

revoke all on public.coach_notes from anon;
