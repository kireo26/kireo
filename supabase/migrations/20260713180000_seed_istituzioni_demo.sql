-- SEED DEMO (facoltativo): 2 istituzioni attive con eventi reali, per una
-- demo immediata di /istituzioni/[slug]. NON è schema, nessun'altra
-- migration ne dipende.
--
-- Limiti onesti di questo seed (vedi report finale della sessione):
-- - Copertina e guida restano vuote: un file reale richiede un upload vero
--   su Storage (bytes, non solo una riga SQL) — il profilo pubblico mostra
--   comunque il fallback con iniziale colorata già previsto per le
--   istituzioni senza copertina. Per la demo: carica una copertina/guida
--   vera dalla dashboard /ente in pochi secondi.
-- - Nessuna riga di recinto_enti/newsletter_iscrizioni/iscrizioni_eventi:
--   richiederebbero studenti demo reali (auth.users con password, non
--   fabbricabili in sicurezza via solo SQL). Per statistiche plausibili in
--   demo: registra 1-2 studenti di prova reali e falli interagire (scarica
--   guida, iscriviti a newsletter/evento) dalle pagine pubbliche — le
--   statistiche in /ente/statistiche si popolano da sole, sono reali.
-- - Nessun institution_profiles: queste 2 istituzioni non hanno un
--   referente con cui accedere (nessun account demo per loro). Per
--   mostrare la dashboard /ente in demo, registra un ente vero dal form.

-- I letterali 'free'/'plus'/'premium' vanno castati esplicitamente: in un
-- insert...select con union, Postgres risolve il tipo comune delle colonne
-- unite (testo) prima di verificare la compatibilità con la colonna di
-- destinazione, quindi l'inferenza automatica di insert...values qui non si
-- applica (errore 42804 senza il cast).
insert into public.piani (nome, prezzo_min, prezzo_max, quota_webinar_anno, quota_newsletter, quota_cta_esterne, quota_comunicazioni_kireo)
select 'free'::public.piano_nome, 0, 0, 3, 0, 0, 0
where not exists (select 1 from public.piani where nome = 'free')
union all
select 'plus'::public.piano_nome, 290, 290, 5, 2, 1, 0
where not exists (select 1 from public.piani where nome = 'plus')
union all
select 'premium'::public.piano_nome, 590, 590, 15, 5, 5, 5
where not exists (select 1 from public.piani where nome = 'premium');

insert into public.istituzioni (id, nome, slug, tipo, descrizione, sito_ufficiale, piano_id, stato)
select
  'b0000000-0000-4000-8000-000000000001',
  'ITS Nuove Tecnologie per il Made in Italy',
  'its-nuove-tecnologie-per-il-made-in-italy',
  'its',
  'Percorso biennale post-diploma per tecnico superiore specializzato in automazione, meccatronica e digitalizzazione dei processi produttivi. Alta percentuale di inserimento lavorativo entro un anno dal diploma.',
  'https://example.com/its-made-in-italy',
  (select id from public.piani where nome = 'free'),
  'attiva'
on conflict (id) do nothing;

insert into public.istituzioni (id, nome, slug, tipo, descrizione, sito_ufficiale, piano_id, stato)
select
  'b0000000-0000-4000-8000-000000000002',
  'Digital Academy Milano',
  'digital-academy-milano',
  'academy',
  'Accademia di formazione professionale su sviluppo software, data analysis e cybersecurity, con laboratori pratici e docenti dal mondo del lavoro.',
  'https://example.com/digital-academy-milano',
  (select id from public.piani where nome = 'premium'),
  'attiva'
on conflict (id) do nothing;

insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti, ore_pcto, stato) values
  (
    'c0000000-0000-4000-8000-000000000001',
    'Automazione industriale: una giornata in laboratorio',
    'Visita guidata ai laboratori di automazione e meccatronica: robot industriali, PLC, linee di produzione digitalizzate.',
    'workshop',
    'b0000000-0000-4000-8000-000000000001',
    '2026-09-24 09:30:00+02',
    '2026-09-24 13:00:00+02',
    'ITS Nuove Tecnologie, sede di Bergamo',
    null,
    40,
    6,
    'approvato'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'Come funziona un percorso ITS: domande e risposte',
    'Webinar informativo online su ammissione, materie, stage e sbocchi professionali del percorso ITS.',
    'webinar',
    'b0000000-0000-4000-8000-000000000001',
    '2026-10-06 18:00:00+02',
    '2026-10-06 19:00:00+02',
    null,
    'https://meet.example.com/its-made-in-italy-open-day',
    300,
    0,
    'approvato'
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'Data Analysis per principianti: primo assaggio',
    'Workshop introduttivo di analisi dati con strumenti reali: dataset, pulizia dati, prime visualizzazioni.',
    'workshop',
    'b0000000-0000-4000-8000-000000000002',
    '2026-09-30 15:00:00+02',
    '2026-09-30 18:00:00+02',
    'Digital Academy Milano, aula 2',
    null,
    25,
    5,
    'approvato'
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    'Cybersecurity: mestieri e percorsi di ingresso',
    'Incontro con professionisti del settore sicurezza informatica: ruoli, competenze richieste, come iniziare.',
    'webinar',
    'b0000000-0000-4000-8000-000000000002',
    '2026-10-14 17:30:00+02',
    '2026-10-14 18:30:00+02',
    null,
    'https://meet.example.com/digital-academy-cybersecurity',
    200,
    0,
    'approvato'
  )
on conflict (id) do nothing;

insert into public.eventi_aree (evento_id, area_slug) values
  ('c0000000-0000-4000-8000-000000000001', 'meccanica-meccatronica'),
  ('c0000000-0000-4000-8000-000000000002', 'meccanica-meccatronica'),
  ('c0000000-0000-4000-8000-000000000003', 'informatica-digitale'),
  ('c0000000-0000-4000-8000-000000000004', 'informatica-digitale'),
  ('c0000000-0000-4000-8000-000000000004', 'sicurezza-difesa')
on conflict (evento_id, area_slug) do nothing;
