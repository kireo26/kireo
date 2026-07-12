-- SEED DEMO (facoltativo): popola l'Agenda con 3 eventi di esempio per
-- poterla vedere subito non vuota in locale/staging. NON è schema — nessuna
-- altra migration ne dipende, puoi applicarlo o ignorarlo a piacere.
-- "Accademia del Gusto" è un nome di fantasia per la demo, non
-- un'istituzione reale con cui KIREO ha un accordo (vedi CLAUDE.md sulla
-- trust strip: mai presentare partner finti come reali).

insert into public.istituzioni (id, nome) values
  ('a0000000-0000-4000-8000-000000000001', 'Accademia del Gusto')
on conflict (id) do nothing;

insert into public.eventi (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti, ore_pcto, stato) values
  (
    'e0000000-0000-4000-8000-000000000001',
    'Come funziona il lavoro in un team di sviluppo software',
    'Un incontro online con professionisti del settore per capire cosa significa lavorare ogni giorno nello sviluppo software: strumenti, ruoli e percorsi di ingresso.',
    'webinar',
    null,
    '2026-09-17 17:00:00+02',
    '2026-09-17 18:00:00+02',
    null,
    'https://meet.example.com/kireo-dev-team',
    200,
    0,
    'approvato'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'Degustazione e mestieri dell''enogastronomia',
    'Workshop pratico: tecniche di degustazione, ruoli in sala e in cucina, e le figure professionali del settore enogastronomico.',
    'workshop',
    'a0000000-0000-4000-8000-000000000001',
    '2026-09-27 09:30:00+02',
    '2026-09-27 13:00:00+02',
    'Accademia del Gusto, Torino',
    null,
    30,
    8,
    'approvato'
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'Orientarsi tra economia, diritto e pubblica amministrazione',
    'Incontro di orientamento con testimonianze su percorsi di studio e primi passi professionali in ambito economico, giuridico e nella PA.',
    'altro',
    null,
    '2026-10-08 15:30:00+02',
    '2026-10-08 17:00:00+02',
    'Aula magna, sede KIREO',
    null,
    80,
    0,
    'approvato'
  )
on conflict (id) do nothing;

insert into public.eventi_aree (evento_id, area_slug) values
  ('e0000000-0000-4000-8000-000000000001', 'informatica-digitale'),
  ('e0000000-0000-4000-8000-000000000002', 'ristorazione-turismo'),
  ('e0000000-0000-4000-8000-000000000003', 'economia-management'),
  ('e0000000-0000-4000-8000-000000000003', 'giurisprudenza-pa')
on conflict (evento_id, area_slug) do nothing;
