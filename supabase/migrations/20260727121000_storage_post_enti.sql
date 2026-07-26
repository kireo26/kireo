-- Bucket di Storage per le immagini dei post di bacheca (tipo=immagine).
-- Stesso schema di istituzioni-media (20260713170000): pubblico in
-- lettura (i post approvati compaiono nel feed studenti), scrittura
-- ristretta al singolo ente sul proprio percorso. Limiti dimensione/
-- formato applicati direttamente sul bucket (file_size_limit/
-- allowed_mime_types), non solo lato form. Convenzione di percorso:
-- {istituzione_id}/post-<timestamp>.<ext>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-enti-media', 'post-enti-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy post_enti_media_select_pubblico
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-enti-media');

create policy post_enti_media_insert_propria
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-enti-media'
    and (storage.foldername(name))[1] = public.current_istituzione_id()::text
  );

create policy post_enti_media_delete_propria
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-enti-media' and (storage.foldername(name))[1] = public.current_istituzione_id()::text);
