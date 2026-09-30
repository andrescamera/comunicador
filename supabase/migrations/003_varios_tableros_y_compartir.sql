-- Varios tableros por usuario y compartir por email.
-- Un «tablero» para el usuario = una fila de `libraries` (el tablero principal con sus carpetas).

-- 1. Varios por usuario ---------------------------------------------------------------------------
drop index if exists public.libraries_owner_unique;
create index if not exists libraries_owner_idx on public.libraries (owner_id);
alter table public.libraries alter column name set default 'Mi tablero';
alter table public.libraries add column if not exists created_at timestamptz not null default now();

-- 2. Acceso compartido ----------------------------------------------------------------------------
create table if not exists public.library_members (
  library_id uuid not null references public.libraries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (library_id, user_id)
);
create index if not exists library_members_user_idx on public.library_members (user_id);

-- Invitaciones a emails que todavía no tienen cuenta: se convierten en acceso al entrar
create table if not exists public.library_invites (
  library_id uuid not null references public.libraries (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (library_id, email)
);
create index if not exists library_invites_email_idx on public.library_invites (email);

alter table public.library_members enable row level security;
alter table public.library_invites enable row level security;

-- 3. Quién puede qué (SECURITY DEFINER para no entrar en bucle con las reglas de las tablas) --------
create or replace function public.is_library_owner(p_library uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.libraries l where l.id = p_library and l.owner_id = (select auth.uid()));
$$;

create or replace function public.can_read_library(p_library uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.libraries l where l.id = p_library and l.owner_id = (select auth.uid()))
      or exists (select 1 from public.library_members m where m.library_id = p_library and m.user_id = (select auth.uid()));
$$;

create or replace function public.can_write_library(p_library uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.libraries l where l.id = p_library and l.owner_id = (select auth.uid()))
      or exists (select 1 from public.library_members m where m.library_id = p_library and m.user_id = (select auth.uid()) and m.role = 'editor');
$$;

revoke all on function public.is_library_owner(uuid) from public, anon;
revoke all on function public.can_read_library(uuid) from public, anon;
revoke all on function public.can_write_library(uuid) from public, anon;
grant execute on function public.is_library_owner(uuid) to authenticated;
grant execute on function public.can_read_library(uuid) to authenticated;
grant execute on function public.can_write_library(uuid) to authenticated;

-- 4. Reglas de seguridad -----------------------------------------------------------------------------
drop policy if exists "bibliotecas propias" on public.libraries;
drop policy if exists "leer bibliotecas" on public.libraries;
drop policy if exists "crear bibliotecas" on public.libraries;
drop policy if exists "cambiar bibliotecas" on public.libraries;
drop policy if exists "borrar bibliotecas" on public.libraries;
create policy "leer bibliotecas" on public.libraries for select to authenticated using (public.can_read_library(id));
create policy "crear bibliotecas" on public.libraries for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "cambiar bibliotecas" on public.libraries for update to authenticated
  using (public.can_write_library(id)) with check (public.can_write_library(id));
create policy "borrar bibliotecas" on public.libraries for delete to authenticated using (owner_id = (select auth.uid()));
-- Nadie cambia el dueño: solo se pueden actualizar el nombre, el tablero principal y la fecha
revoke update on public.libraries from authenticated;
grant update (name, root_board_id, updated_at) on public.libraries to authenticated;

drop policy if exists "tableros propios" on public.boards;
drop policy if exists "leer tableros" on public.boards;
drop policy if exists "escribir tableros" on public.boards;
drop policy if exists "cambiar tableros" on public.boards;
drop policy if exists "borrar tableros" on public.boards;
create policy "leer tableros" on public.boards for select to authenticated using (public.can_read_library(library_id));
create policy "escribir tableros" on public.boards for insert to authenticated with check (public.can_write_library(library_id));
create policy "cambiar tableros" on public.boards for update to authenticated
  using (public.can_write_library(library_id)) with check (public.can_write_library(library_id));
create policy "borrar tableros" on public.boards for delete to authenticated using (public.can_write_library(library_id));

drop policy if exists "copias propias" on public.board_backups;
drop policy if exists "leer copias" on public.board_backups;
drop policy if exists "guardar copias" on public.board_backups;
create policy "leer copias" on public.board_backups for select to authenticated using (public.can_read_library(library_id));
create policy "guardar copias" on public.board_backups for insert to authenticated with check (public.can_write_library(library_id));

-- Miembros: cada uno ve su propio acceso (y puede dejarlo); el dueño ve y quita a todos.
-- Dar acceso solo se hace con share_library().
drop policy if exists "ver miembros" on public.library_members;
drop policy if exists "quitar miembros" on public.library_members;
create policy "ver miembros" on public.library_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_library_owner(library_id));
create policy "quitar miembros" on public.library_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_library_owner(library_id));

drop policy if exists "ver invitaciones" on public.library_invites;
drop policy if exists "quitar invitaciones" on public.library_invites;
create policy "ver invitaciones" on public.library_invites for select to authenticated using (public.is_library_owner(library_id));
create policy "quitar invitaciones" on public.library_invites for delete to authenticated using (public.is_library_owner(library_id));

-- 5. Funciones para la app -------------------------------------------------------------------------

-- Tableros a los que tengo acceso (propios y compartidos), con el email del dueño
create or replace function public.my_libraries()
returns table (id uuid, name text, root_board_id text, role text, owner_email text, updated_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, l.root_board_id,
         case when l.owner_id = (select auth.uid()) then 'owner' else m.role end,
         u.email::text, l.updated_at, l.created_at
  from public.libraries l
  join auth.users u on u.id = l.owner_id
  left join public.library_members m on m.library_id = l.id and m.user_id = (select auth.uid())
  where l.owner_id = (select auth.uid()) or m.user_id is not null
  order by l.created_at;
$$;

-- Compartir con un email. Si tiene cuenta, acceso directo; si no, invitación pendiente.
-- No devuelve nada: no se puede usar para averiguar si un email tiene cuenta.
create or replace function public.share_library(p_library uuid, p_email text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not public.is_library_owner(p_library) then raise exception 'Solo el dueño puede compartir este tablero'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'Permiso no válido'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email no válido'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_user = (select auth.uid()) then return; end if; -- el dueño ya tiene acceso
  if v_user is not null then
    insert into public.library_members (library_id, user_id, role) values (p_library, v_user, p_role)
      on conflict (library_id, user_id) do update set role = excluded.role;
  else
    insert into public.library_invites (library_id, email, role, invited_by) values (p_library, v_email, p_role, (select auth.uid()))
      on conflict (library_id, email) do update set role = excluded.role;
  end if;
end $$;

-- Quién tiene acceso a un tablero (solo el dueño). Miembros e invitaciones se ven igual.
create or replace function public.library_access(p_library uuid) returns table (email text, role text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, m.role from public.library_members m join auth.users u on u.id = m.user_id
    where m.library_id = p_library and public.is_library_owner(p_library)
  union
  select i.email, i.role from public.library_invites i
    where i.library_id = p_library and public.is_library_owner(p_library)
  order by 1;
$$;

-- Quitar el acceso de un email (solo el dueño)
create or replace function public.unshare_library(p_library uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.is_library_owner(p_library) then raise exception 'Solo el dueño puede quitar el acceso'; end if;
  delete from public.library_members m using auth.users u
    where m.library_id = p_library and u.id = m.user_id and lower(u.email) = v_email;
  delete from public.library_invites i where i.library_id = p_library and i.email = v_email;
end $$;

-- Al entrar: las invitaciones a mi email (confirmado) pasan a ser acceso
create or replace function public.claim_invites() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_count integer;
begin
  select lower(u.email) into v_email from auth.users u where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  insert into public.library_members (library_id, user_id, role)
    select i.library_id, (select auth.uid()), i.role from public.library_invites i
    join public.libraries l on l.id = i.library_id
    where i.email = v_email and l.owner_id <> (select auth.uid())
    on conflict (library_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.library_invites where email = v_email;
  return v_count;
end $$;

revoke all on function public.my_libraries() from public, anon;
revoke all on function public.share_library(uuid, text, text) from public, anon;
revoke all on function public.library_access(uuid) from public, anon;
revoke all on function public.unshare_library(uuid, text) from public, anon;
revoke all on function public.claim_invites() from public, anon;
grant execute on function public.my_libraries() to authenticated;
grant execute on function public.share_library(uuid, text, text) to authenticated;
grant execute on function public.library_access(uuid) to authenticated;
grant execute on function public.unshare_library(uuid, text) to authenticated;
grant execute on function public.claim_invites() to authenticated;

-- Tiempo real: que la lista de tableros se entere de nuevos accesos
do $$
begin
  alter publication supabase_realtime add table public.library_members;
exception when duplicate_object then null;
end $$;
