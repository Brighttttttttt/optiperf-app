-- ============================================================
-- Optiperf — trois méthodes de calcul des zones de fréquence cardiaque
-- À exécuter dans l'éditeur SQL Supabase, après 016.
-- ============================================================
--
-- Jusqu'ici les zones se déduisaient d'une seule façon : en pourcentage de la
-- FC max (`src/lib/zones.ts`, migration 010). C'est la méthode la plus simple
-- et la moins juste — elle suppose que la fréquence de repos ne compte pas.
--
-- Deux autres s'ajoutent :
--
--   * **LTHR** — les zones se calent sur la fréquence au seuil lactique plutôt
--     que sur le maximum. C'est là que se joue l'entraînement, et c'est la
--     référence des plans de course. Demande une nouvelle donnée, ajoutée ici.
--
--   * **Karvonen** — raisonne en *réserve* cardiaque (FC max moins FC de
--     repos). Deux coureurs de même FC max mais de repos différents n'ont pas
--     les mêmes zones, et c'est vrai. Ne demande **rien de nouveau** :
--     `fc_repos` existe depuis 010, saisie par l'athlète, et n'a jamais servi.
--     Son commentaire l'annonçait — « utile plus tard (réserve de Karvonen),
--     sans usage aujourd'hui ». Le plus tard, c'est ici.
--
-- La méthode retenue est une donnée de l'athlète, comme FC max et VMA : le
-- coach la lit, il ne la choisit pas.

alter table public.profiles
  add column lthr int check (lthr is null or lthr between 100 and 220),
  add column zone_method text not null default 'fcmax'
    check (zone_method in ('fcmax', 'lthr', 'karvonen'));

-- La LTHR se situe forcément sous le maximum : au-dessus, c'est une saisie
-- inversée, et les zones qui en découleraient seraient absurdes.
alter table public.profiles
  add constraint profiles_lthr_lt_fc_max
  check (lthr is null or fc_max is null or lthr < fc_max);

-- ============ Le second verrou, sans lequel l'écriture échoue en silence ====
--
-- 001 restreint l'UPDATE sur `profiles` aux seules colonnes qu'un athlète peut
-- modifier — un privilège **par colonne**, pas par table (complété par 010 et
-- 012). Sans les lignes qui suivent, la RLS laisserait passer une mise à jour
-- que Postgres refuserait quand même, sans que l'athlète voie autre chose
-- qu'« Impossible d'enregistrer ».
--
-- C'est le défaut déjà rencontré deux fois : sur FC max/repos, puis sur la VMA.

grant update (lthr, zone_method) on table public.profiles to authenticated;
