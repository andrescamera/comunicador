-- Comunicador: sincronización de tableros entre la web y la tablet
-- Ejecutar una vez en Supabase → SQL Editor.

-- Una biblioteca de tableros por usuario (preparada para compartir más adelante)
create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Mis tableros',
  root_board_id text not null,
  updated_at timestamptz not null default now()
);
create unique index if not exists libraries_owner_unique on public.libraries (owner_id);

-- Un registro por tablero; `data` es el tablero tal cual lo usa la app (celdas, posiciones, zonas...)
create table if not exists public.boards (
  library_id uuid not null references public.libraries (id) on delete cascade,
  id text not null,
  data jsonb,
  updated_at timestamptz not null,           -- momento del cambio en el dispositivo
  deleted boolean not null default false,    -- borrado marcado: no "resucita" desde otro dispositivo
  server_updated_at timestamptz not null default now(),
  primary key (library_id, id)
);

-- Versiones que perdieron en un conflicto (el mismo tablero editado en dos sitios a la vez)
create table if not exists public.board_backups (
  id bigint generated always as identity primary key,
  library_id uuid not null references public.libraries (id) on delete cascade,
  board_id text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists boards_touch on public.boards;
create trigger boards_touch before insert or update on public.boards
  for each row execute function public.touch_server_updated_at();

-- Seguridad por filas: cada usuario solo puede leer y escribir lo suyo
alter table public.libraries enable row level security;
alter table public.boards enable row level security;
alter table public.board_backups enable row level security;

drop policy if exists "bibliotecas propias" on public.libraries;
create policy "bibliotecas propias" on public.libraries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tableros propios" on public.boards;
create policy "tableros propios" on public.boards
  for all using (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = auth.uid()));

drop policy if exists "copias propias" on public.board_backups;
create policy "copias propias" on public.board_backups
  for all using (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = auth.uid()));

-- Tiempo real: la tablet se entera al momento de los cambios hechos en la web (y al revés)
do $$
begin
  alter publication supabase_realtime add table public.boards;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.libraries;
exception when duplicate_object then null;
end $$;

-- RGPD: borrar la cuenta y todos sus datos (las tablas se borran en cascada)
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
