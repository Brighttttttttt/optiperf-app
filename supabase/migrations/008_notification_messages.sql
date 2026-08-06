-- ============================================================
-- Optiperf — notification à la réception d'un message
-- À exécuter dans l'éditeur SQL Supabase, après 007.
-- ============================================================
--
-- Signalé par un athlète : aucune notification n'existe aujourd'hui quand un
-- message arrive, contrairement à une séance planifiée ou complétée qui en
-- déclenchent une (voir on_session_planned / on_session_completed, 001).
-- Le manque n'était pas une régression : ce trigger n'avait jamais été écrit.

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    new.recipient_id,
    'message',
    coalesce(
      (select full_name from public.profiles where id = new.sender_id),
      'Un message'
    ) || ' t''a écrit',
    new.content,
    '/messages/' || new.sender_id
  );
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.notify_new_message();
