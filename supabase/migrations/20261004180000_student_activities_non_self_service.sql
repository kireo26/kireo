-- ⚠️ LE ORE PCTO, PER L'ALTRA PORTA. Il 4/10 abbiamo chiuso
-- `iscrizioni_eventi` (20261004140000): uno studente non può più scriversi
-- `stato = 'partecipato'` e vedersi sommare le ore dell'evento. Questa è la
-- seconda strada, e porta allo stesso contatore.
--
-- VERIFICATO PER ESECUZIONE su una replica con tutte le migrazioni:
--
--   insert into student_activities (student_id, activity_id, stato, ore_certificate)
--   values (auth.uid(), '<una attività qualunque>', 'completata', 90);
--
-- passa, e `getOreCertificate` (lib/app/pcto.ts) legge **90 ore su 90**. Con un
-- `update` diventano 9999, perché `ore_certificate` è `numeric(5,1)` con il
-- solo `check (>= 0)`.
--
-- LA POLICY È `with check (student_id = auth.uid())`: verifica di chi è la
-- riga, non cosa dice la riga. La stessa specie di `iscrizioni_eventi`, nello
-- stesso contatore.
--
-- ED È PEGGIO DELL'ALTRA, per una ragione sola: `iscrizioni_eventi` ha le
-- colonne che dicono chi ha certificato (`certificata_da_tipo`,
-- `certificata_da_user`, `certificata_il`), quindi la cura era inchiodarle a
-- null e la catena di responsabilità resta leggibile. **`student_activities`
-- non ha nessuna colonna del genere**: `ore_certificate` è un numero che si
-- chiama «certificate» e in tutta la tabella non c'è niente che dica da chi.
-- L'intero disegno presuppone che la riga la scriva la scuola, e quella
-- presupposizione non è scritta da nessuna parte.
--
-- ══════════════════════════════ LA CURA ══════════════════════════════
--
-- NESSUN CODICE DELL'APP SCRIVE QUESTA TABELLA. [verificato su app/,
-- components/, lib/, scripts/: solo `select`, più le policy e una menzione nel
-- commento di `lib/app/pcto.ts`.] Non esiste una pagina che certifichi ore per
-- questa strada: la pipeline lato scuola passa da `certifica_presenza`, che
-- scrive `iscrizioni_eventi` e registra chi ha certificato.
--
-- Quindi le due policy di scrittura hanno **zero utenti legittimi** e vanno
-- via. Come `evidence`, `area_signal`, `presenze_live`, `attestati`: tabelle la
-- cui unica strada è una funzione, o nessuna strada affatto finché quella
-- funzione non si scriverà.
--
-- LA LETTURA RESTA, e con lei tutto quello che funziona oggi: il contatore
-- dello studente (`student_activities_select_own`), «Le mie attività», e la
-- scheda studente che la scuola legge. Non si perde nessuna riga esistente: la
-- tabella in produzione è vuota.
--
-- ⚠️ QUELLO CHE QUESTA MIGRAZIONE NON DECIDE. Il giorno in cui la pipeline
-- scolastica tradizionale servirà davvero, questa tabella avrà bisogno di una
-- funzione che la scriva — e quella funzione dovrà registrare CHI certifica,
-- come fa `certifica_presenza`, perché un numero che si chiama «ore
-- certificate» senza un certificatore è la stessa cosa che abbiamo appena
-- chiuso con un'altra faccia. Non si costruisce qui: qui si chiude una porta
-- che nessuno usava e che dava a uno studente le proprie ore PCTO.

drop policy if exists student_activities_insert_own on public.student_activities;
drop policy if exists student_activities_update_own on public.student_activities;

comment on table public.student_activities is
  'Attività PCTO certificate dalla scuola. NESSUNA SCRITTURA DAL CLIENT dal '
  '4/10: nessun percorso dell''app la scrive, e fino a quella data le due '
  'policy `student_id = auth.uid()` — che verificano DI CHI e'' la riga e non '
  'cosa la riga dice — lasciavano a uno studente inserirsi '
  '`ore_certificate = 90`, che il contatore della home sommava. La tabella non '
  'ha colonne che dicano CHI ha certificato: se un giorno servirà scriverla, '
  'servirà una funzione che le registri, come fa certifica_presenza.';
