-- ============================================================
-- Optiperf — qui peut supprimer une séance
-- À exécuter dans l'éditeur SQL Supabase, après 017.
-- ============================================================
--
-- La politique de 001 était large : `athlete_id = moi OR is_my_athlete(...)`.
-- Elle autorisait donc un athlète à effacer une séance **prescrite par son
-- coach**, et un coach à effacer une séance **déjà rapportée par son athlète**.
--
-- Les deux contredisent la séparation tenue partout ailleurs par le trigger
-- `enforce_session_ownership` (002) : la prescription appartient au coach, le
-- compte rendu à l'athlète. Une suppression est la modification la plus
-- radicale qui soit — c'est le dernier endroit où l'on voudrait que la règle
-- soit plus lâche qu'ailleurs.
--
-- Personne n'avait encore pu s'en apercevoir : `deleteSession` existait dans
-- le code sans être branchée à aucun écran. Elle l'est désormais (#133), et
-- la RLS ne doit pas être plus permissive que ce que l'interface propose.
--
-- ============ Les deux cas autorisés ============
--
--   * **Le coach efface ce qu'il a prescrit, tant que c'est à venir.** Une
--     séance déjà rapportée porte le RPE, la durée réelle et le ressenti de
--     l'athlète : l'effacer reviendrait à effacer son travail. S'il s'est
--     trompé sur une séance faite, c'est à l'athlète de la retirer.
--
--   * **L'athlète efface ses séances libres**, faites ou non — c'est son
--     carnet, et il n'y a aucune prescription à préserver.
--
-- Ce qui reste interdit, volontairement : un athlète n'efface pas une
-- prescription. S'il ne l'a pas faite, il la déclare manquée. C'est à cela que
-- sert le statut, et c'est ce qui garde l'adhérence honnête.
--
-- Les activités rattachées survivent : `activities.session_id` est
-- `on delete set null` (007) — ce qu'une montre a mesuré reste vrai même si la
-- séance qui la portait disparaît. Blocs, exercices et comptes rendus
-- d'exercices tombent en cascade avec elle.

drop policy "sessions_delete" on public.sessions;

create policy "sessions_delete" on public.sessions for delete to authenticated
  using (
    -- Le coach, sur sa prescription encore à venir.
    (
      coach_id = (select auth.uid())
      and public.is_my_athlete(athlete_id)
      and status = 'planned'
    )
    -- L'athlète, sur ses séances libres.
    or (coach_id is null and athlete_id = (select auth.uid()))
  );
