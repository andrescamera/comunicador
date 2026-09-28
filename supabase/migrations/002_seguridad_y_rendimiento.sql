-- Recomendaciones del asesor de Supabase

-- search_path fijo en la función del disparador
create or replace function public.touch_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

-- Reglas de seguridad: auth.uid() se calcula una vez por consulta, no por fila
drop policy if exists "bibliotecas propias" on public.libraries;
create policy "bibliotecas propias" on public.libraries
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "tableros propios" on public.boards;
create policy "tableros propios" on public.boards
  for all using (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = (select auth.uid())));

drop policy if exists "copias propias" on public.board_backups;
create policy "copias propias" on public.board_backups
  for all using (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.libraries l where l.id = library_id and l.owner_id = (select auth.uid())));

-- Índice para la clave ajena de las copias
create index if not exists board_backups_library_idx on public.board_backups (library_id);

-- delete_my_account es SECURITY DEFINER a propósito: cada usuario solo puede borrar su propia cuenta (auth.uid()).
