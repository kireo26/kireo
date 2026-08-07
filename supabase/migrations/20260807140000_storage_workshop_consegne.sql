-- Bucket di Storage per le consegne dei workshop: PRIVATO (a differenza di
-- post-enti-media/istituzioni-media, qui i file sono compiti personali
-- dello studente, non contenuto pubblico). Lettura e scrittura ristrette
-- al proprio percorso; l'app genera signed URL a tempo per la
-- visualizzazione, mai un getPublicUrl (fallirebbe comunque su un bucket
-- non pubblico). Convenzione di percorso: {student_id}/{iscrizione_id}/
-- <timestamp>_<nomefile>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workshop-consegne',
  'workshop-consegne',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy workshop_consegne_media_select_propria
  on storage.objects for select
  to authenticated
  using (bucket_id = 'workshop-consegne' and (storage.foldername(name))[1] = auth.uid()::text);

create policy workshop_consegne_media_insert_propria
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workshop-consegne' and (storage.foldername(name))[1] = auth.uid()::text);

create policy workshop_consegne_media_admin_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'workshop-consegne' and public.current_ruolo() = 'admin');
