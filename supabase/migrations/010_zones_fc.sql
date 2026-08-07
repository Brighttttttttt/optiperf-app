-- ============================================================
-- Optiperf — fréquence cardiaque de référence de l'athlète
-- À exécuter dans l'éditeur SQL Supabase, après 009.
-- ============================================================
--
-- FC max sert de base au calcul des 5 zones (migration 009 porte la trace
-- par séance dont le temps par zone se déduit). FC repos est facultative :
-- utile plus tard (réserve de Karvonen), sans usage aujourd'hui.
--
-- Saisie par l'athlète, comme le reste du compte rendu : la policy
-- `profiles_update` de 001 (id = auth.uid()) couvre déjà ces colonnes, la
-- lecture par le coach est déjà couverte par `profiles_select`. Aucune
-- policy nouvelle n'est nécessaire.
--
-- Le second verrou, lui, l'est : 001 restreint l'UPDATE sur `profiles` à la
-- seule colonne `full_name` (privilèges par colonne, défense en profondeur).
-- Sans l'étendre ici, la RLS laisserait passer une mise à jour que Postgres
-- refuserait quand même — silencieusement pour l'athlète, qui ne verrait
-- jamais sa FC max enregistrée.

alter table public.profiles
  add column fc_max int check (fc_max is null or fc_max between 100 and 230),
  add column fc_repos int check (fc_repos is null or fc_repos between 25 and 120);

alter table public.profiles
  add constraint profiles_fc_repos_lt_fc_max
  check (fc_repos is null or fc_max is null or fc_repos < fc_max);

grant update (fc_max, fc_repos) on table public.profiles to authenticated;
