-- ============================================================
-- Optiperf — rappel hebdomadaire de planification
-- À exécuter dans l'éditeur SQL Supabase, après 004.
-- ============================================================
--
-- Le rappel vit dans la base plutôt que dans un cron Vercel : cela évite
-- d'exposer la clé secrète côté hébergeur et de protéger une URL publique.

create extension if not exists pg_cron;

create or replace function public.notify_unplanned_week()
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := now() at time zone 'Europe/Paris';
  v_start date;
  v_end date;
  r record;
begin
  -- Le planificateur tourne en UTC et le décalage parisien change deux fois
  -- par an : la tâche est déclenchée à 16 h et 17 h UTC, et seule celle qui
  -- tombe sur 18 h à Paris fait le travail.
  if extract(hour from v_now) <> 18 then
    return;
  end if;

  -- La semaine qui vient : du lendemain (lundi) au dimanche suivant.
  v_start := v_now::date + 1;
  v_end := v_start + 6;

  for r in
    select ca.coach_id,
           array_agg(p.full_name order by p.full_name) as noms
    from public.coach_athletes ca
    join public.profiles p on p.id = ca.athlete_id
    where not exists (
      select 1
      from public.sessions s
      where s.athlete_id = ca.athlete_id
        and s.date between v_start and v_end
        and s.coach_id is not null
    )
    group by ca.coach_id
  loop
    -- Filet contre un double déclenchement : un seul rappel par soirée.
    if exists (
      select 1 from public.notifications
      where recipient_id = r.coach_id
        and type = 'week_unplanned'
        and created_at > now() - interval '12 hours'
    ) then
      continue;
    end if;

    insert into public.notifications (recipient_id, type, title, body, link)
    values (
      r.coach_id,
      'week_unplanned',
      'Semaine à planifier',
      array_to_string(r.noms, ', ') ||
        case when array_length(r.noms, 1) > 1
          then ' n''ont rien de prévu pour la semaine qui vient.'
          else ' n''a rien de prévu pour la semaine qui vient.'
        end,
      '/planifier'
    );
  end loop;
end;
$$;

-- Personne ne déclenche le rappel depuis l'application : c'est une tâche
-- de fond, pas une action utilisateur.
revoke all on function public.notify_unplanned_week() from public, anon, authenticated;

-- Dimanche soir, 18 h heure de Paris (voir le garde-fou ci-dessus).
select cron.unschedule('optiperf-rappel-planification')
where exists (
  select 1 from cron.job where jobname = 'optiperf-rappel-planification'
);

select cron.schedule(
  'optiperf-rappel-planification',
  '0 16,17 * * 0',
  $$select public.notify_unplanned_week()$$
);
