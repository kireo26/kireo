-- Infrastruttura webinar in diretta (1/3): scelta di hosting della diretta
-- YouTube. Due modalità:
-- - 'kireo' (default): l'evento non richiede alcun link in fase di
--   creazione — è KIREO che, in approvazione o successivamente, programma
--   la diretta sul proprio canale e aggancia youtube_video_id. Fino a
--   quel momento la pagina live mostra "diretta in preparazione".
-- - 'proprio': l'ente trasmette dal proprio canale YouTube (diretta "non
--   in elenco"): deve fornire subito youtube_video_id e accettare la
--   checklist di policy (vedi CHECK sotto).
-- L'admin può impostare/modificare/RIMUOVERE youtube_video_id in ogni
-- momento indipendentemente dallo stato dell'evento (kill switch): rimuovere
-- l'id fa sparire il link "Entra nella diretta" e la pagina live torna a
-- mostrare "diretta non disponibile" — nessuna colonna o policy dedicata,
-- basta la policy eventi_admin_tutto già esistente (for all, senza
-- restrizioni di stato), quindi nessuna nuova RLS è necessaria qui.

alter table public.eventi
  add column hosting_diretta text not null default 'kireo' check (hosting_diretta in ('kireo', 'proprio')),
  add column youtube_video_id text,
  add column checklist_diretta jsonb,
  add column checklist_diretta_accettata_il timestamptz;

comment on column public.eventi.hosting_diretta is
  'kireo (default): nessun link richiesto alla creazione, l''id lo imposta KIREO in approvazione o dopo. proprio: l''ente trasmette dal proprio canale, deve fornire subito youtube_video_id + checklist_diretta.';

comment on column public.eventi.youtube_video_id is
  'Id del video YouTube (estratto/validato lato app da un URL, vedi lib/youtube.ts). Nullable per costruzione: assente finché KIREO non lo programma (hosting_diretta=kireo) o rimosso dall''admin come kill switch (rimozione = "Entra nella diretta" sparisce, pagina live mostra "diretta non disponibile").';

comment on column public.eventi.checklist_diretta is
  'Solo per hosting_diretta=proprio: oggetto JSON con un timestamp ISO per ciascuna delle 4 voci accettate (non_in_elenco, incorporamento_attivo, chat_disattivata, no_contenuti_terzi) — accettazione registrata al momento dell''invio del form, non modificabile dopo (nessuna policy update self-service oltre eventi_update_propria_non_revisionato, che comunque si chiude non appena l''evento esce da bozza/in_approvazione).';

comment on column public.eventi.checklist_diretta_accettata_il is
  'Timestamp del submit del form con tutte e 4 le voci della checklist accettate insieme (un''unica sottomissione, non 4 istanti separati) — vedi checklist_diretta per il dettaglio per voce.';

alter table public.eventi
  add constraint eventi_diretta_proprio_coerente check (
    hosting_diretta = 'kireo'
    or (
      youtube_video_id is not null
      and checklist_diretta_accettata_il is not null
      and checklist_diretta ? 'non_in_elenco'
      and checklist_diretta ? 'incorporamento_attivo'
      and checklist_diretta ? 'chat_disattivata'
      and checklist_diretta ? 'no_contenuti_terzi'
    )
  );
