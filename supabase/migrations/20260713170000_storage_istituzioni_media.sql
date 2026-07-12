-- Bucket di Storage per copertine e guide PDF delle istituzioni. Bucket
-- pubblico in lettura (le copertine e le guide compaiono sul profilo
-- pubblico dell'ente, servito a chiunque); scrittura ristretta al singolo
-- ente sul proprio percorso, tramite policy su storage.objects (stesso
-- meccanismo RLS delle tabelle normali, storage.objects è una tabella
-- Postgres come le altre). Convenzione di percorso:
-- {istituzione_id}/copertina-<timestamp>.<ext> e
-- {istituzione_id}/guida-<timestamp>.pdf — il primo segmento del path
-- (storage.foldername) deve combaciare con l'istituzione dell'utente.

insert into storage.buckets (id, name, public)
values ('istituzioni-media', 'istituzioni-media', true)
on conflict (id) do nothing;

create policy istituzioni_media_select_pubblico
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'istituzioni-media');

create policy istituzioni_media_insert_propria
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'istituzioni-media'
    and (storage.foldername(name))[1] = public.current_istituzione_id()::text
  );

create policy istituzioni_media_update_propria
  on storage.objects for update
  to authenticated
  using (bucket_id = 'istituzioni-media' and (storage.foldername(name))[1] = public.current_istituzione_id()::text)
  with check (bucket_id = 'istituzioni-media' and (storage.foldername(name))[1] = public.current_istituzione_id()::text);

create policy istituzioni_media_delete_propria
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'istituzioni-media' and (storage.foldername(name))[1] = public.current_istituzione_id()::text);
