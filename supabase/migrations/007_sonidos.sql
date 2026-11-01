-- Sonidos de las fichas «Sonido» (animales, transportes…): espacio privado, una carpeta por tablero
-- («<library_id>/<sonido>.mp3»), con los mismos permisos que las fotos. Se copian de Freesound (CC0)
-- al elegirlos, para que suenen sin conexión y aunque desaparezcan de allí.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sonidos', 'sonidos', false, 1048576, array['audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ver sonidos" on storage.objects;
drop policy if exists "subir sonidos" on storage.objects;
drop policy if exists "cambiar sonidos" on storage.objects;
drop policy if exists "borrar sonidos" on storage.objects;
create policy "ver sonidos" on storage.objects for select to authenticated
  using (bucket_id = 'sonidos' and private.can_read_library(private.photo_library(name)));
create policy "subir sonidos" on storage.objects for insert to authenticated
  with check (bucket_id = 'sonidos' and private.can_write_library(private.photo_library(name)));
create policy "cambiar sonidos" on storage.objects for update to authenticated
  using (bucket_id = 'sonidos' and private.can_write_library(private.photo_library(name)));
create policy "borrar sonidos" on storage.objects for delete to authenticated
  using (bucket_id = 'sonidos' and private.can_write_library(private.photo_library(name)));

-- La clave de Freesound va en el Vault (no en el repositorio), con el nombre 'freesound_api_key':
--   select vault.create_secret('<clave>', 'freesound_api_key');
-- La lee la función «sonidos» (supabase/functions/sonidos), la única que habla con Freesound.
