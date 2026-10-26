-- Fotos de las fichas (en lugar del pictograma): espacio privado, una carpeta por tablero
-- («<library_id>/<foto>.jpg»). Las ven quienes pueden ver el tablero; las suben o quitan quienes
-- pueden editarlo. Sin enlaces públicos: la app pide un enlace temporal para mostrarlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- El tablero de una foto, por su ruta (null si la ruta no empieza por un id válido)
create or replace function private.photo_library(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$' then split_part(p_name, '/', 1)::uuid end
$$;

drop policy if exists "ver fotos" on storage.objects;
drop policy if exists "subir fotos" on storage.objects;
drop policy if exists "cambiar fotos" on storage.objects;
drop policy if exists "borrar fotos" on storage.objects;
create policy "ver fotos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and private.can_read_library(private.photo_library(name)));
create policy "subir fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and private.can_write_library(private.photo_library(name)));
create policy "cambiar fotos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and private.can_write_library(private.photo_library(name)));
create policy "borrar fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and private.can_write_library(private.photo_library(name)));
