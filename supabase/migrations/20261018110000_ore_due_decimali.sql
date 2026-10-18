-- Le ore PCTO a DUE decimali (Mario, 18/10).
--
-- `eventi.ore_pcto` e `student_activities.ore_certificate` erano
-- `numeric(5,1)`, e Postgres ARROTONDA AL SALVATAGGIO: un ente che scriveva
-- 0,75 — quarantacinque minuti, il formato più comune che abbiamo — trovava 0,8
-- in tutta la catena (contatore dello studente, CSV, scheda studente della
-- scuola, statistiche), e nessuno glielo diceva. Il numero su cui una scuola
-- certifica non era quello che l'ente aveva dichiarato.
--
-- Non è un caso di bordo: un quarto d'ora è l'unità naturale del PCTO. Una
-- colonna che non sa tenere 0,75 non è troppo stretta per un valore raro, è
-- troppo stretta per il valore tipico. Far rifiutare il form vorrebbe dire
-- dire a un ente «non puoi dichiarare quarantacinque minuti».
--
-- ⚠️ IL TRONCAMENTO NON SPARISCE, SI SPOSTA al terzo decimale. La regola che
-- resta anche dopo: se il database non può tenere il numero che una persona
-- ha scritto, o lo rifiutiamo o glielo diciamo — mai cambiarlo in silenzio.
-- Il form (`CreaEventoForm`) rifiuta più di due decimali sul campo.
--
-- ENUMERAZIONE DI CHI LEGGE O SOMMA ORE, ognuno con cosa gli succede:
--   • `stats_scuola.ore_pcto_totali` (sum di `eventi.ore_pcto`) — la vista
--     DIPENDE dalla colonna, e Postgres non lascia cambiare il tipo di una
--     colonna usata da una vista: si droppa e si ricrea verbatim da
--     `20260715160000` (unica definizione nel repo). La pagina
--     `/scuola/statistiche` ora formatta con `formattaNumero`.
--   • `lib/app/pcto.ts` (contatore dello studente: somma delle due colonne) —
--     arrotonda a due decimali invece di uno.
--   • `lib/app/eventi.ts` `getOrePctoDaEventi` — somma in JS: invariato.
--   • `lib/scuola/studenteDettaglio.ts` — legge e somma: invariato.
--   • i quattro posti che stampavano `{ore_pcto}h PCTO` grezzo, col PUNTO
--     (`CardEvento`, `CardEventiPerTe`, `/scuola/eventi`, scheda studente) —
--     ora `formattaNumero`. Stesso numero, stesso difetto.
--   • `lib/eventi/orePcto.ts` (l'avviso sulle ore sproporzionate) — confronta
--     un Number: invariato.
--   • `chiudi_diretta_evento`, `certifica_presenza` — non leggono le ore (le
--     ore le somma chi le mostra): invariate.
-- ESCLUSIONE SCRITTA: `activities.ore_pcto` NON si tocca. È la tabella
-- catalogo predisposta in Fase 2 e mai usata da nessun flusso; nessuno la
-- somma. Allargarla non costerebbe niente, ma una colonna che nessuno legge
-- non va toccata per simmetria: se un giorno servirà, si allarga insieme al
-- primo lettore.
--
-- Nessun dato trasformato: allargare la scala non cambia nessun valore già
-- salvato (0,8 resta 0,80 — quello che è stato arrotondato prima di oggi NON
-- si recupera, e non si prova a indovinarlo).

drop view if exists public.stats_scuola;

alter table public.eventi
  alter column ore_pcto type numeric(6, 2);

alter table public.student_activities
  alter column ore_certificate type numeric(6, 2);

-- Ricreata VERBATIM da 20260715160000_stats_scuola.sql.
create view public.stats_scuola as
select
  sp.id as scuola_profilo_id,
  (
    select count(*) from public.student_profiles s
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato'
  ) as studenti_verificati,
  (
    select count(*)
    from public.iscrizioni_eventi ie
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as partecipazioni_totali,
  (
    select coalesce(sum(e.ore_pcto), 0)
    from public.iscrizioni_eventi ie
    join public.eventi e on e.id = ie.evento_id
    join public.student_profiles s on s.user_id = ie.student_id
    where s.school_code = sp.scuola_id and s.stato_verifica = 'verificato' and ie.stato = 'partecipato'
  ) as ore_pcto_totali
from public.scuole_profili sp
where sp.id = public.current_scuola_profilo_id() or public.current_ruolo() = 'admin';

comment on view public.stats_scuola is
  'Aggregati per scuola (mai righe individuali di studenti, mai dati di profilazione). Distribuzione per area in stats_scuola_aree.';
