-- ============================================================
-- Optiperf — schéma initial
-- À exécuter dans l'éditeur SQL du projet Supabase
-- (Dashboard → SQL Editor → coller ce fichier → Run)
-- ============================================================

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('coach', 'athlete')),
  full_name text not null,
  invite_code text unique,
  created_at timestamptz not null default now()
);

-- V1 : un athlète est lié à un seul coach (unique sur athlete_id)
create table public.coach_athletes (
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  unique (athlete_id)
);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  target_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Une seule table pour le planifié ET le réalisé.
-- Une séance libre (non planifiée par le coach) a coach_id null
-- et est créée directement en status 'completed'.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid references public.profiles (id) on delete set null,
  date date not null,
  title text not null,
  type text not null default 'endurance',
  description text,
  duration_planned_min int check (duration_planned_min > 0),
  status text not null default 'planned' check (status in ('planned', 'completed', 'missed')),
  duration_actual_min int check (duration_actual_min > 0),
  rpe int check (rpe between 1 and 10),
  athlete_comment text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_athlete_date_idx on public.sessions (athlete_id, date desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ============ FONCTIONS D'AIDE (security definer : évitent la
-- récursion RLS en court-circuitant les politiques de coach_athletes) ============

create or replace function public.is_my_athlete(aid uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.coach_athletes
    where coach_id = auth.uid() and athlete_id = aid
  );
$$;

create or replace function public.is_my_coach(cid uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.coach_athletes
    where athlete_id = auth.uid() and coach_id = cid
  );
$$;

-- ============ CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION ============

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'athlete');
begin
  if v_role not in ('coach', 'athlete') then
    v_role := 'athlete';
  end if;
  insert into public.profiles (id, role, full_name, invite_code)
  values (
    new.id,
    v_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Utilisateur'),
    case when v_role = 'coach'
      then upper(substr(md5(gen_random_uuid()::text), 1, 6))
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ LIAISON ATHLÈTE → COACH PAR CODE D'INVITATION ============

create or replace function public.link_to_coach(code text)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  if (select role from public.profiles where id = auth.uid()) is distinct from 'athlete' then
    raise exception 'Seul un athlète peut rejoindre un coach.';
  end if;
  select id into v_coach
  from public.profiles
  where role = 'coach' and invite_code = upper(trim(code));
  if v_coach is null then
    raise exception 'Code d''invitation invalide.';
  end if;
  insert into public.coach_athletes (coach_id, athlete_id)
  values (v_coach, auth.uid())
  on conflict (athlete_id) do update set coach_id = excluded.coach_id;
end;
$$;

-- ============ NOTIFICATIONS AUTOMATIQUES (triggers) ============

create or replace function public.notify_session_planned()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'planned' and new.coach_id is not null and new.coach_id <> new.athlete_id then
    insert into public.notifications (recipient_id, type, title, body, link)
    values (
      new.athlete_id,
      'session_planned',
      'Nouvelle séance planifiée',
      new.title || ' — ' || to_char(new.date, 'DD/MM'),
      '/'
    );
  end if;
  return new;
end;
$$;

create trigger on_session_planned
  after insert on public.sessions
  for each row execute function public.notify_session_planned();

create or replace function public.notify_session_completed()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_coach uuid;
  v_was_completed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_was_completed := (old.status = 'completed');
  end if;
  if new.status = 'completed' and not v_was_completed then
    select coach_id into v_coach
    from public.coach_athletes
    where athlete_id = new.athlete_id;
    if v_coach is not null then
      insert into public.notifications (recipient_id, type, title, body, link)
      values (
        v_coach,
        'session_completed',
        (select full_name from public.profiles where id = new.athlete_id) || ' a terminé une séance',
        new.title || coalesce(' — RPE ' || new.rpe, ''),
        '/athletes/' || new.athlete_id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger on_session_completed
  after insert or update on public.sessions
  for each row execute function public.notify_session_completed();

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles enable row level security;
alter table public.coach_athletes enable row level security;
alter table public.objectives enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- profiles : soi-même, ses athlètes (coach) ou son coach (athlète)
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_my_athlete(id)
    or public.is_my_coach(id)
  );
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- coach_athletes : visibles par les deux parties ; création via link_to_coach uniquement
create policy "coach_athletes_select" on public.coach_athletes for select to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));
create policy "coach_athletes_delete" on public.coach_athletes for delete to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));

-- objectives : l'athlète et son coach
create policy "objectives_select" on public.objectives for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));
create policy "objectives_insert" on public.objectives for insert to authenticated
  with check (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));
create policy "objectives_update" on public.objectives for update to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id))
  with check (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));
create policy "objectives_delete" on public.objectives for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

-- sessions : l'athlète et son coach
create policy "sessions_select" on public.sessions for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));
create policy "sessions_insert" on public.sessions for insert to authenticated
  with check (
    (coach_id = (select auth.uid()) and public.is_my_athlete(athlete_id))
    or athlete_id = (select auth.uid())
  );
create policy "sessions_update" on public.sessions for update to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id))
  with check (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));
create policy "sessions_delete" on public.sessions for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.is_my_athlete(athlete_id));

-- messages : uniquement entre un coach et ses athlètes
create policy "messages_select" on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (public.is_my_athlete(recipient_id) or public.is_my_coach(recipient_id))
  );
create policy "messages_update" on public.messages for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- notifications : uniquement le destinataire (création par triggers)
create policy "notifications_select" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "notifications_update" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- ============ PRIVILÈGES PAR COLONNE (défense en profondeur) ============
-- Un utilisateur ne peut modifier que son nom (pas son rôle ni son code),
-- et seuls read_at sont modifiables sur messages/notifications.

revoke insert, delete on table public.profiles from authenticated, anon;
revoke update on table public.profiles from authenticated, anon;
grant update (full_name) on table public.profiles to authenticated;

revoke insert on table public.coach_athletes from authenticated, anon;
revoke update on table public.coach_athletes from authenticated, anon;

revoke update on table public.messages from authenticated, anon;
grant update (read_at) on table public.messages to authenticated;

revoke insert, delete on table public.notifications from authenticated, anon;
revoke update on table public.notifications from authenticated, anon;
grant update (read_at) on table public.notifications to authenticated;

-- ============ TEMPS RÉEL (messagerie + notifications) ============

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
