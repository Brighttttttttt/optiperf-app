-- ============================================================
-- Optiperf — codes d'invitation renforcés et limite de débit
-- À exécuter dans l'éditeur SQL Supabase, après 003.
-- ============================================================

-- ============ 1. CODES D'INVITATION PLUS LONGS ============
-- 6 caractères hexadécimaux (16,7 M de combinaisons) devenaient devinables
-- par force brute. On passe à 10 caractères sur un alphabet de 32 signes,
-- soit ~1,1 × 10^15 combinaisons.
--
-- L'alphabet exclut les caractères confondables (0/O, 1/I/L) : le code est
-- lu sur un écran et retapé à la main par l'athlète.

create or replace function public.generate_invite_code()
returns text language plpgsql volatile
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..10 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Improbable, mais l'unicité est contractuelle : on retire au besoin.
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Les nouveaux coachs reçoivent un code au nouveau format.
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
    case when v_role = 'coach' then public.generate_invite_code() else null end
  );
  return new;
end;
$$;

-- Les codes courts existants sont remplacés. Les liaisons déjà établies ne
-- sont pas affectées : le code ne sert qu'au moment de rejoindre un groupe.
update public.profiles
set invite_code = public.generate_invite_code()
where role = 'coach' and (invite_code is null or length(invite_code) < 10);

-- ============ 2. LIMITE DE DÉBIT SUR LES MESSAGES ============
-- Seul canal où un compte authentifié peut déverser du volume. 20 messages
-- par minute laisse toute latitude à une conversation humaine et bloque
-- l'envoi automatisé.

create or replace function public.enforce_message_rate_limit()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- Contexte d'administration (script de démo) : pas de limite.
  if auth.uid() is null then
    return new;
  end if;

  select count(*) into recent
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent >= 20 then
    raise exception 'Trop de messages envoyés coup sur coup. Patiente une minute.';
  end if;

  return new;
end;
$$;

create trigger enforce_message_rate_limit_trigger
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

create index if not exists messages_sender_recent_idx
  on public.messages (sender_id, created_at desc);
