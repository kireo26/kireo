-- SEED DEMO (facoltativo): un'istituzione formazione_docenti reale
-- (docenti.it) + 2 webinar docenti approvati, per vedere l'area /docente
-- popolata subito. Stesso limite onesto già noto dai seed precedenti: nessun
-- account/credenziali demo (richiederebbe un auth.users reale, non
-- fabbricabile in sicurezza via solo SQL) — per iscrizioni/certificazioni
-- vere, registra un docente reale da /per-i-docenti e iscrivilo a uno dei
-- due webinar dalle pagine pubbliche.

insert into public.istituzioni (id, nome, slug, tipo, descrizione, sito_ufficiale, piano_id, stato)
select
  'c0000000-0000-4000-8000-000000000001',
  'docenti.it',
  'docenti-it',
  'formazione_docenti',
  'Formazione continua per docenti su intelligenza artificiale nella didattica, valutazione, etica e normativa, riduzione della burocrazia e orientamento PCTO.',
  'https://example.com/docenti-it',
  (select id from public.piani where nome = 'free'),
  'attiva'
on conflict (id) do nothing;

insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, ore_pcto, stato, pubblico, filone)
select
  'c1000000-0000-4000-8000-000000000001',
  'AI in classe: dalla teoria alla pratica quotidiana',
  'Come usare l''intelligenza artificiale per preparare esercizi, verifiche e materiali didattici senza perdere il controllo sulla qualità dei contenuti.',
  'webinar',
  'c0000000-0000-4000-8000-000000000001',
  '2026-09-10 17:00:00+02',
  '2026-09-10 18:30:00+02',
  null,
  'https://example.com/webinar-ai-classe',
  0,
  'approvato',
  'docenti',
  'ai_didattica'::public.filone_docenti
on conflict (id) do nothing;

insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, ore_pcto, stato, pubblico, filone)
select
  'c1000000-0000-4000-8000-000000000002',
  'Orientamento e PCTO: costruire un percorso coerente con lo studente',
  'Strumenti pratici per accompagnare gli studenti nella scelta post-diploma e integrare l''orientamento nel percorso PCTO, senza aggiungere carico burocratico.',
  'webinar',
  'c0000000-0000-4000-8000-000000000001',
  '2026-09-24 17:00:00+02',
  '2026-09-24 18:30:00+02',
  null,
  'https://example.com/webinar-orientamento-pcto',
  0,
  'approvato',
  'docenti',
  'orientamento_pcto'::public.filone_docenti
on conflict (id) do nothing;
