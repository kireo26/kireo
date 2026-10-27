-- LE STATISTICHE DELL'ENTE CONTANO QUELLO CHE DICONO (Mario, 27/10) — migrazione
-- J1 di due. Due numeri sbagliati in `/ente/statistiche`, visti a schermo su
-- Davante.
--
-- 1) «DOWNLOAD GUIDA: 0», MA LA GUIDA ERA STATA SCARICATA. `download_guida`
--    contava le righe di `recinto_enti` con origine `guida`, e `recinto_enti`
--    teneva UNA riga per studente ed ente, la prima: chi si era già iscritto a
--    un evento dell'ente (origine `evento`) e poi scaricava la guida non
--    lasciava nessuna traccia del download (`ignoreDuplicates` scartava la riga
--    in silenzio). Quindi il numero era «studenti il cui PRIMO contatto con
--    l'ente è stata la guida», e lo leggeva chi credeva fossero i download.
--    Da qui: una riga per studente, ente e ORIGINE. Il nuovo vincolo nasce
--    accanto al vecchio; il vecchio esce con J2 (`20261102120000`), dopo il
--    deploy che porta i tre scrittori sul bersaglio nuovo.
--    ⚠️ I DOWNLOAD SCARTATI PRIMA DI OGGI NON SI RECUPERANO: non sono mai stati
--    scritti da nessuna parte.
--
-- 2) «0 ISCRITTI · 1 PARTECIPATI» SULLA STESSA RIGA. `iscritti` contava solo
--    lo stato `iscritto`, e una presenza certificata passa da `iscritto` a
--    `partecipato`: il numero diceva «iscritti non ancora certificati», cioè
--    una cosa a cui un ente non pensa mai. Ora `iscritti` conta ogni riga di
--    iscrizione (iscritto, partecipato, assente), quindi `partecipati` non può
--    superarlo. ⚠️ Il NOME «partecipati» resta, e resta falso a metà: conta le
--    presenze certificate (soglia raggiunta, o certificate dalla scuola), non
--    chi «c'era». Il nome lo decide Mario.
--
-- I due `studenti_nel_recinto` e `download_guida` diventano conteggi di
-- studenti DISTINTI: con una riga per origine, lo stesso studente comparirebbe
-- fino a tre volte. Prima di J2 i numeri sono gli stessi di oggi (c'è ancora
-- una riga sola per coppia), quindi questa vista è giusta nei due mondi.
--
-- COME SI VERIFICA APPLICATA: il vincolo `recinto_enti_unica_per_origine` esiste
-- in `pg_constraint` (lo crea solo questa migrazione).

alter table public.recinto_enti
  add constraint recinto_enti_unica_per_origine unique (student_id, istituzione_id, origine);

create or replace view public.stats_istituzione as
select
  i.id as istituzione_id,
  (select count(distinct r.student_id) from public.recinto_enti r where r.istituzione_id = i.id) as studenti_nel_recinto,
  (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = i.id) as iscritti_newsletter,
  (select count(*) from public.guide_enti g where g.istituzione_id = i.id) as guide_pubblicate,
  (
    select count(distinct r.student_id) from public.recinto_enti r where r.istituzione_id = i.id and r.origine = 'guida'
  ) as download_guida,
  (
    select count(*)
    from public.activity_log al
    where al.student_id in (select r.student_id from public.recinto_enti r where r.istituzione_id = i.id)
      and al.area_slug in (select ea.area_slug from public.eventi e join public.eventi_aree ea on ea.evento_id = e.id where e.organizzatore_id = i.id)
  ) as interazioni_stimate
from public.istituzioni i
where i.id = public.current_istituzione_id() or public.current_ruolo() = 'admin';

comment on view public.stats_istituzione is
  '20261102110000: aggregati per istituzione (mai righe individuali). studenti_nel_recinto = studenti distinti che hanno scaricato una guida, si sono iscritti alla newsletter o a un evento dell''ente; download_guida = studenti distinti che hanno scaricato almeno una guida da collegati. interazioni_stimate è una stima best-effort, non un conteggio.';

create or replace view public.stats_eventi_istituzione as
select
  e.organizzatore_id as istituzione_id,
  e.id as evento_id,
  e.titolo,
  e.data_inizio,
  count(ie.id) as iscritti,
  count(*) filter (where ie.stato = 'partecipato') as partecipati,
  (e.domanda_consegna is not null) as domanda_posta,
  (select count(*) from public.consegne_evento ce where ce.evento_id = e.id) as risposte
from public.eventi e
left join public.iscrizioni_eventi ie on ie.evento_id = e.id
where e.organizzatore_id = public.current_istituzione_id() or public.current_ruolo() = 'admin'
group by e.organizzatore_id, e.id, e.titolo, e.data_inizio, e.domanda_consegna;

comment on view public.stats_eventi_istituzione is
  '20261102110000: per evento, solo per l''organizzatore (o admin). iscritti = ogni iscrizione, in qualunque stato (iscritto, partecipato, assente); partecipati = presenze certificate (stato partecipato), quindi mai più di iscritti; risposte = consegne_evento, con domanda_posta che dice se quel numero ha un senso.';
