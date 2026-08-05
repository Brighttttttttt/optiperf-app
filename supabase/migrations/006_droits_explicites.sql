-- ============================================================
-- Optiperf — droits explicites pour le rôle d'administration
-- À exécuter dans l'éditeur SQL Supabase, après 005.
-- ============================================================
--
-- Sur Supabase hébergé, `service_role` reçoit ses droits automatiquement à
-- la création des tables : nos migrations n'avaient donc jamais eu à les
-- déclarer, et la production fonctionne. Mais une base reconstruite à partir
-- du seul dépôt — c'est le cas en intégration continue — n'a pas ces droits,
-- et tout accès administrateur échoue.
--
-- On les rend explicites : le dépôt suffit désormais à reconstruire une base
-- complète. Sur la base existante, ces instructions ne font que confirmer des
-- droits déjà accordés.
--
-- `service_role` est la clé d'administration : elle contourne la RLS par
-- conception, et ne sert qu'aux scripts locaux (peuplement, maintenance).
-- Les droits de `authenticated` et `anon`, eux, ne sont pas touchés : ce sont
-- eux qui encadrent l'application, et ils restent définis en 001 et 002.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Les tables ajoutées par les migrations suivantes en héritent d'office.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
