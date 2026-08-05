-- ============================================================
-- Optiperf — modèle de permissions explicite
-- À exécuter dans l'éditeur SQL Supabase, après 005.
-- ============================================================
--
-- Sur Supabase hébergé, les rôles de l'API reçoivent leurs droits
-- automatiquement à la création des tables : nos migrations n'avaient donc
-- jamais eu à les déclarer, et la production fonctionne. Mais une base
-- reconstruite à partir du seul dépôt — c'est le cas en intégration continue
-- — n'en a aucun, et tout accès échoue.
--
-- On déclare ici le modèle complet. Sur la base existante, ces instructions
-- ne font que confirmer l'état en place ; sur une base neuve, elles le
-- créent. Le dépôt suffit désormais à reconstruire une base fonctionnelle.
--
-- Ces droits sont le premier verrou ; la RLS définie en 001 et 002 reste le
-- second, et c'est elle qui décide *quelles lignes* chacun voit.

grant usage on schema public to anon, authenticated, service_role;

-- ============ Rôle d'administration ============
-- Contourne la RLS par conception. Réservé aux scripts locaux (peuplement,
-- maintenance) : sa clé ne quitte jamais la machine du développeur.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- ============ Utilisateur connecté ============
-- Table par table, au plus juste. La RLS restreint ensuite aux seules lignes
-- qui le concernent.

-- Son profil et ceux de ses interlocuteurs : lecture seule, sauf son nom.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- La liaison coach ↔ athlète se crée par la fonction link_to_coach, jamais
-- directement ; chacun peut en revanche la rompre.
grant select, delete on public.coach_athletes to authenticated;

grant select, insert, update, delete on public.objectives to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_templates to authenticated;

-- Un message s'écrit et se lit, ne se réécrit pas : seul son marquage
-- « lu » est modifiable.
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Les notifications naissent de déclencheurs, jamais du client.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ============ Visiteur non connecté ============
-- Aucune politique RLS ne le vise : il ne doit rien pouvoir lire ni écrire.

revoke all on all tables in schema public from anon;
