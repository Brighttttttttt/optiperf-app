-- ============================================================
-- Optiperf — modèles de séances réutilisables
-- À exécuter dans l'éditeur SQL Supabase, après 002_hardening.sql
-- ============================================================

-- Bibliothèque personnelle du coach : les séances qu'il redonne souvent,
-- prêtes à être appliquées à plusieurs athlètes et plusieurs dates.
create table public.session_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  type text not null default 'endurance' check (char_length(type) <= 40),
  description text check (description is null or char_length(description) <= 4000),
  duration_planned_min int check (duration_planned_min > 0),
  created_at timestamptz not null default now()
);

create index session_templates_coach_idx
  on public.session_templates (coach_id, created_at desc);

alter table public.session_templates enable row level security;

-- Un modèle n'appartient qu'à son coach : personne d'autre ne le voit.
create policy "templates_select" on public.session_templates for select to authenticated
  using (coach_id = (select auth.uid()));

create policy "templates_insert" on public.session_templates for insert to authenticated
  with check (coach_id = (select auth.uid()));

create policy "templates_update" on public.session_templates for update to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

create policy "templates_delete" on public.session_templates for delete to authenticated
  using (coach_id = (select auth.uid()));
