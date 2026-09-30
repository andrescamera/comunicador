-- Las comprobaciones de acceso las usan las reglas de seguridad, no la app: fuera del API público
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_library_owner(uuid) set schema private;
alter function public.can_read_library(uuid) set schema private;
alter function public.can_write_library(uuid) set schema private;

-- Las funciones de la app las llaman por nombre: se vuelven a crear apuntando al esquema nuevo
create or replace function public.share_library(p_library uuid, p_email text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not private.is_library_owner(p_library) then raise exception 'Solo el dueño puede compartir este tablero'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'Permiso no válido'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email no válido'; end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_user = (select auth.uid()) then return; end if;
  if v_user is not null then
    insert into public.library_members (library_id, user_id, role) values (p_library, v_user, p_role)
      on conflict (library_id, user_id) do update set role = excluded.role;
  else
    insert into public.library_invites (library_id, email, role, invited_by) values (p_library, v_email, p_role, (select auth.uid()))
      on conflict (library_id, email) do update set role = excluded.role;
  end if;
end $$;

create or replace function public.library_access(p_library uuid) returns table (email text, role text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, m.role from public.library_members m join auth.users u on u.id = m.user_id
    where m.library_id = p_library and private.is_library_owner(p_library)
  union
  select i.email, i.role from public.library_invites i
    where i.library_id = p_library and private.is_library_owner(p_library)
  order by 1;
$$;

create or replace function public.unshare_library(p_library uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not private.is_library_owner(p_library) then raise exception 'Solo el dueño puede quitar el acceso'; end if;
  delete from public.library_members m using auth.users u
    where m.library_id = p_library and u.id = m.user_id and lower(u.email) = v_email;
  delete from public.library_invites i where i.library_id = p_library and i.email = v_email;
end $$;

create index if not exists library_invites_invited_by_idx on public.library_invites (invited_by);
