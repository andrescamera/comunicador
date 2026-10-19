-- Versiones de un tablero (biblioteca entera: principal, carpetas y grupos) para poder volver a un
-- estado anterior. Se guardan al salir de edición con cambios y antes de cambios grandes; se
-- conservan las 5 últimas de cada tablero.
create table if not exists public.library_versions (
  id bigint generated always as identity primary key,
  library_id uuid not null references public.libraries (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_email text default (auth.jwt() ->> 'email'),
  reason text not null default 'Guardar', -- «Guardar», «Antes de aplicar el texto», «Antes de restaurar»…
  data jsonb not null -- { rootId, boards }
);

create index if not exists library_versions_library_idx on public.library_versions (library_id, created_at desc);

alter table public.library_versions enable row level security;

drop policy if exists "leer versiones" on public.library_versions;
drop policy if exists "guardar versiones" on public.library_versions;
create policy "leer versiones" on public.library_versions for select to authenticated
  using (private.can_read_library(library_id));
create policy "guardar versiones" on public.library_versions for insert to authenticated
  with check (private.can_write_library(library_id) and created_by = (select auth.uid()));

-- Solo las 5 últimas de cada tablero
create or replace function private.prune_library_versions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.library_versions v
  where v.library_id = new.library_id
    and v.id not in (
      select k.id from public.library_versions k
      where k.library_id = new.library_id
      order by k.created_at desc, k.id desc
      limit 5
    );
  return null;
end $$;

drop trigger if exists library_versions_prune on public.library_versions;
create trigger library_versions_prune after insert on public.library_versions
  for each row execute function private.prune_library_versions();
