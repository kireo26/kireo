-- LO STUDENTE POTEVA SCRIVERSI «PARTECIPATO», E CON LUI LE PROPRIE ORE PCTO.
--
-- Nato da una domanda di Mario sul contatore delle ore: «le ore nascono da
-- `stato`, la certificazione è scritta in `certificata_il`/`certificata_da_tipo`
-- — sono due colonne diverse e nessuna delle due è la fonte dell'altra. Chi
-- scrive `stato = 'partecipato'`?»
--
-- NEL CODICE: nessuno oltre alle tre funzioni di certificazione
-- [verificato, non dedotto, su tutto l'albero] — `certifica_presenza`
-- (20260715140000, scrive 'scuola'), `certifica_partecipazione_docente`
-- (20260722130000, 'ente'/'kireo') e `chiudi_diretta_evento` (20260726110000,
-- 'sistema'). Tutte e tre scrivono `stato` e `certificata_da_tipo` nella stessa
-- istruzione, quindi dal lato del codice le due colonne non possono dissentire.
--
-- MA IL CLIENT SÌ, e questa è la risposta vera alla sua domanda: a scrivere
-- `partecipato` non è «qualcun altro» nel codice, è lo studente stesso.
-- `iscrizioni_eventi_insert_own` (12 luglio) è:
--
--     with check (student_id = auth.uid())
--
-- e NIENTE vincola `stato`, `origine`, `iscritto_da` né le tre colonne della
-- certificazione. Un `insert` dalla sessione di uno studente con
-- `stato = 'partecipato'` passa, e `getOrePctoDaEventi` (lib/app/eventi.ts)
-- somma `eventi.ore_pcto` su `stato = 'partecipato'` **senza guardare
-- `certificata_da_tipo`** — quindi le ore arrivano nel contatore.
--
-- VERIFICATO PER ESECUZIONE, non dedotto da una lettura della policy: su una
-- replica con tutte le migrazioni, `set local role authenticated` + il `sub`
-- di uno studente, un insert con `stato = 'partecipato'` e
-- `certificata_da_tipo = 'sistema'` passa, e la query esatta del contatore
-- restituisce le ore dell'evento.
--
-- È LA SPECIE DI CASA, nel punto in cui costa più caro: il commento della
-- tabella, scritto il 12 luglio, DICHIARA la regola che la policy non applica —
-- «Lo stato oltre "iscritto" (partecipato/assente) è aggiornato da KIREO —
-- nessun pannello self-service in questa fase; lo studente può solo iscriversi
-- o cancellare la propria iscrizione.» La regola era decisa, scritta, e non
-- imposta da nessuna parte. Quindi questa migrazione non prende una decisione
-- nuova: applica quella.
--
-- E le ore PCTO non sono un numero qualunque: sono la sola cosa di KIREO che ha
-- un valore formale davanti a una scuola.
--
-- QUATTRO VINCOLI, e ognuno ha la sua ragione — non sono lo stesso vincolo
-- scritto quattro volte:
--
--   stato = 'iscritto'            le ore e la partecipazione non si
--                                 autodichiarano;
--   certificata_* tutte null      la catena di responsabilità la scrive chi
--                                 certifica. Senza questo si potrebbe scrivere
--                                 `certificata_da_tipo = 'sistema'`, cioè
--                                 fabbricare una riga che SEMBRA prodotta dal
--                                 nostro heartbeat — e `'sistema'` è proprio il
--                                 discriminante su cui poggia il profilo della
--                                 presenza (20261004160000);
--   origine = 'studente'          `origine = 'scuola'` significa «l'ha iscritto
--                                 un referente», e `certifica_presenza` la
--                                 legge per decidere se uno studente è
--                                 «raggiungibile» da quella scuola: scriversela
--                                 da sé vuol dire rendersi certificabile su un
--                                 evento in cui la propria scuola non ha mai
--                                 messo piede;
--   iscritto_da is null           è l'uuid di CHI ha iscritto: un campo che
--                                 nomina una terza persona non lo riempie
--                                 l'interessato.
--
-- LA DELETE, che è la seconda metà e si dimentica: un'iscrizione si disdice,
-- una certificazione no. Senza il vincolo, cancellare la propria riga
-- certificata e reinserirne una pulita rimette lo studente nell'insieme che
-- `chiudi_diretta_evento` certifica (il suo ciclo richiede
-- `certificata_da_tipo is null`, e la riga in `presenze_live` resta): una
-- seconda chiusura scriverebbe una seconda prova. Disdire un'iscrizione non
-- ancora certificata resta permesso, ed è l'unico caso che serviva.
--
-- NON ROMPE NIENTE [verificato]: i due soli insert dal client passano
-- `{ student_id, evento_id }` e nient'altro (`IscrivitiEventoButton`,
-- `IscrivitiWebinarButton`), quindi prendono i default — `stato` 'iscritto',
-- `origine` 'studente', il resto null. Le scritture d'ufficio e le
-- certificazioni passano da funzioni SECURITY DEFINER, che non vedono questa
-- policy.

drop policy iscrizioni_eventi_insert_own on public.iscrizioni_eventi;

create policy iscrizioni_eventi_insert_own
  on public.iscrizioni_eventi for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and stato = 'iscritto'
    and origine = 'studente'
    and iscritto_da is null
    and certificata_da_tipo is null
    and certificata_da_user is null
    and certificata_il is null
  );

drop policy iscrizioni_eventi_delete_own on public.iscrizioni_eventi;

create policy iscrizioni_eventi_delete_own
  on public.iscrizioni_eventi for delete
  to authenticated
  using (student_id = auth.uid() and certificata_da_tipo is null);

comment on table public.iscrizioni_eventi is
  'Iscrizioni di uno studente a un evento. Lo stato oltre "iscritto" (partecipato/assente), l''origine d''ufficio e le tre colonne della certificazione NON sono self-service: la policy di insert lo impone (vedi 20261004140000), non solo questo commento — che dal 12 luglio al 4 ottobre dichiarava la regola senza che niente la applicasse. Lo studente può iscriversi e disdire un''iscrizione non ancora certificata.';
