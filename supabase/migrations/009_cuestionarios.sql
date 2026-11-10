-- Cuestionarios de vocabulario (onboarding de un niño nuevo). La logopeda crea uno y comparte su
-- enlace (/cuestionario/<token>) con el tutor, que lo rellena SIN cuenta. Al enviarlo queda cerrado
-- y la logopeda crea el tablero con las respuestas.
--
-- El tutor no tiene acceso a la tabla: solo a las dos funciones de abajo, que exigen el token
-- (244 bits aleatorios, imposible de adivinar). Las respuestas son datos de un menor: la logopeda
-- puede borrar el cuestionario cuando ya no lo necesite.

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  child_name text not null default '' check (char_length(child_name) <= 80),
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists questionnaires_owner_idx on public.questionnaires (owner_id);

alter table public.questionnaires enable row level security;

-- La logopeda: solo los suyos
drop policy if exists "ver cuestionarios" on public.questionnaires;
drop policy if exists "crear cuestionarios" on public.questionnaires;
drop policy if exists "cambiar cuestionarios" on public.questionnaires;
drop policy if exists "borrar cuestionarios" on public.questionnaires;
create policy "ver cuestionarios" on public.questionnaires for select to authenticated using (owner_id = (select auth.uid()));
create policy "crear cuestionarios" on public.questionnaires for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "cambiar cuestionarios" on public.questionnaires for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "borrar cuestionarios" on public.questionnaires for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.questionnaires from anon, authenticated;
grant select, delete on public.questionnaires to authenticated;
grant insert (child_name, answers) on public.questionnaires to authenticated;
-- Ni el dueño ni el token cambian; la logopeda puede reabrirlo (status) o corregir el nombre
grant update (child_name, answers, status, updated_at, submitted_at) on public.questionnaires to authenticated;

-- El tutor (con el enlace) -------------------------------------------------------------------------

create or replace function public.questionnaire_by_token(p_token text)
returns table (child_name text, answers jsonb, status text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select q.child_name, q.answers, q.status, q.updated_at
  from public.questionnaires q
  where char_length(p_token) = 64 and q.token = p_token;
$$;

-- Guarda las respuestas mientras se rellena; con p_submit = true lo envía y queda cerrado.
-- Devuelve el estado; si ya estaba enviado, no cambia nada y devuelve 'enviado'.
create or replace function public.questionnaire_save(p_token text, p_answers jsonb, p_submit boolean default false)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if char_length(p_token) <> 64 then raise exception 'Enlace no válido'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Respuestas no válidas'; end if;
  if octet_length(p_answers::text) > 100000 then raise exception 'Las respuestas son demasiado largas'; end if;

  select q.status into v_status from public.questionnaires q where q.token = p_token for update;
  if v_status is null then raise exception 'Enlace no válido'; end if;
  if v_status = 'enviado' then return v_status; end if;

  update public.questionnaires q
     set answers = p_answers,
         updated_at = now(),
         status = case when p_submit then 'enviado' else 'pendiente' end,
         submitted_at = case when p_submit then now() else null end
   where q.token = p_token;
  return case when p_submit then 'enviado' else 'pendiente' end;
end $$;

revoke all on function public.questionnaire_by_token(text) from public;
revoke all on function public.questionnaire_save(text, jsonb, boolean) from public;
grant execute on function public.questionnaire_by_token(text) to anon, authenticated;
grant execute on function public.questionnaire_save(text, jsonb, boolean) to anon, authenticated;
