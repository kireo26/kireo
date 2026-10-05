-- ⚠️ UNO STUDENTE SI VERIFICA DA SÉ, A UNA SCUOLA QUALUNQUE. Verificato per
-- esecuzione su una replica con tutte le migrazioni, non leggendo le policy.
--
-- UNA SOLA SCRITTURA, dalla porta normale del client:
--
--   update student_profiles
--      set school_code = '<una scuola qualunque>', classe = '5ª Z',
--          stato_verifica = 'verificato',
--          verificato_da = auth.uid(), verificato_il = now()
--    where user_id = auth.uid();
--
-- Passa. `student_profiles_update_own` (10/07) è `using (user_id = auth.uid())
-- with check (user_id = auth.uid())`: verifica DI CHI è la riga, non COSA DICE
-- la riga. La stessa specie di `iscrizioni_eventi` (20261004140000),
-- `institution_profiles` (20261004170000) e `student_activities`
-- (20261004180000).
--
-- PERCHÉ È LA PIÙ GRAVE DELLE QUATTRO, e la ragione non è un accesso:
-- `/privacy` dichiara la verifica scolastica come rafforzamento della base di
-- legittimazione per gli studenti minorenni. Quindi non è «uno studente entra
-- dove non dovrebbe»: è il MECCANISMO con cui dichiariamo di trattare
-- lecitamente i dati di un minore che si può autodichiarare. Non una porta
-- aperta — il fondamento che regge la porta.
--
-- ══════ LE DUE GUARDIE DI LUGLIO ERANO CORRETTE E IL BUCO È FRA LORO ══════
--
-- `blocco_cambio_scuola_verificato` (20260715120000) ha due rami:
--   • il primo scatta se `old.stato_verifica = 'verificato'` → blocca il cambio
--     scuola di chi è già verificato. Corretto.
--   • il secondo scatta se `old.stato_verifica <> 'verificato'` E la scuola
--     cambia E `new.stato_verifica = old.stato_verifica` → riporta a
--     `dichiarato`. Corretto, e la sua terza condizione fu aggiunta con una
--     ragione scritta (non sovrascrivere un rifiuto appena deciso).
--
-- Un'UPDATE che cambia STATO E SCUOLA INSIEME non entra in nessuno dei due: il
-- primo guarda il vecchio stato (che è `dichiarato`), il secondo pretende che
-- lo stato non cambi (e cambia). LE DIFESE NON SI SOMMANO: due rami che
-- coprono due casi non coprono il caso che li attraversa.
--
-- E la prova che è questa la specie, non una guardia debole: in DUE statement
-- separati (stato prima, scuola dopo) il secondo viene respinto. La guardia
-- funzionava. Era l'atomicità a passare in mezzo — una cosa che nessuno dei due
-- rami poteva vedere, perché nessuno dei due guarda la COPPIA.
--
-- ══════════════════════════════ LA CURA ══════════════════════════════
--
-- LA POLICY, NON IL TRIGGER, e la ragione è che non serve nessun discriminante:
-- `verifica_studente` è SECURITY DEFINER e scavalca la RLS, quindi una policy
-- governa SOLO le scritture dal client e la funzione non la vede nemmeno.
--
-- ⚠️ LA STRADA DEL TRIGGER È STATA PROVATA E SCARTATA, e come è caduta vale più
-- del fatto che sia caduta. L'idea era inchiodare le tre colonne a OLD quando
-- chi scrive non è dentro una SECURITY DEFINER, distinguendo i due casi con
-- `current_user` vs `session_user`. Sulla replica: dal client
-- `current=authenticated session=postgres` (divergono), dentro la definer
-- `current=postgres session=postgres` (coincidono). Con quel trigger addosso
-- l'autoverifica attecchiva E `verifica_studente` smetteva di funzionare — una
-- cura che lascia il buco e rompe la funzione sana.
--
-- E IL VALORE CHE QUEL TEST GUARDAVA È UNA PROPRIETÀ DELLA REPLICA, NON DEL
-- SISTEMA: lì `session_user` è `postgres` perché lo shim fa `set local role` da
-- una sessione postgres. In Supabase vero PostgREST si collega come
-- `authenticator`, quindi i due divergono in TUTTI E DUE i casi e il
-- discriminante non discrimina niente. Sarebbe stato verde sulla replica e
-- avrebbe fatto il contrario in produzione — proprio nel punto in cui replica e
-- produzione differiscono, cioè dove serviva guardare.
--
-- ══════ LA FRAGILITÀ È SCELTA, STRETTA, E SORVEGLIATA ══════
--
-- `stato_verifica = 'dichiarato'` nel `with check` POGGIA SU DUE MECCANISMI CHE
-- VIVONO ALTROVE:
--   (a) il secondo ramo del trigger riporta a `dichiarato` chi cambia scuola —
--       senza di lui, un rifiutato che ridichiara verrebbe respinto;
--   (b) il rifiuto azzera `school_code` (`verifica_studente`, ramo else) —
--       senza di lui, un rifiutato potrebbe salvare la SOLA classe senza
--       cambiare scuola, il trigger non lo riporterebbe a `dichiarato` e la
--       policy lo respingerebbe.
--
-- L'alternativa autonoma era `stato_verifica <> 'verificato'`. SI È SCELTA LA
-- STRETTA, e non per la tenuta: per COME FALLISCE. Se qualcuno tolse uno dei
-- due meccanismi, la stretta RIFIUTA un'azione legittima — un difetto rumoroso,
-- che il primo utente scopre e che si ripara. La larga lascerebbe scrivere uno
-- stato che nessuno ha voluto (un autorifiuto), cioè un difetto silenzioso.
-- Fra un rifiuto sbagliato e una scrittura sbagliata si prende il rifiuto: il
-- primo lo scopre il primo utente, il secondo non lo scopre nessuno.
--
-- MA UNA DIPENDENZA NASCOSTA SI SCEGLIE SOLO SE SI TRASFORMA IN UNA DIPENDENZA
-- SORVEGLIATA. I due meccanismi sono una proprietà: `npm run test:studente`
-- (lessicale, sulle definizioni VIVE) e le proprietà 8-9 di
-- scripts/verifica-student-profiles.sql (eseguite). Se qualcuno li toglie deve
-- diventare rossa QUELLA — non deve diventare rosso uno studente.
--
-- COSA NON CHIUDE. Dichiarare una scuola resta self-service, di proposito: è il
-- primo passo del flusso (`finalize_registration`, `p_school_code` libero dal
-- client oppure un `class_codes` riscattato) e il referente ha bisogno di
-- vedere la dichiarazione per decidere. Quello che non è più self-service è
-- l'ESITO di quella decisione.

drop policy if exists student_profiles_update_own on public.student_profiles;

create policy student_profiles_update_own
  on public.student_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Le tre colonne della verifica non sono cose che lo studente dichiara di
    -- sé: le scrive `verifica_studente`, che scavalca questa policy.
    and stato_verifica = 'dichiarato'
    and verificato_da is null
    and verificato_il is null
  );

comment on table public.student_profiles is
  'Profilo studente: la scuola dichiarata (school_code/classe, self-service di '
  'proposito) e l''esito della verifica della scuola (stato_verifica/'
  'verificato_da/verificato_il), che il client NON puo'' scrivere dal 5/10 — li '
  'scrive solo verifica_studente, SECURITY DEFINER con la delega e la scuola '
  'che combacia. Fino a quella data il commento della colonna stato_verifica '
  'dichiarava la meta'' che era imposta (il trigger: «verificato e'' '
  'definitivo») e taceva sull''altra (nessuno impediva di SCRIVERSI '
  '«verificato»): non una divergenza, un silenzio parziale, che e'' peggio '
  'perche'' la parte scritta fa sembrare la tabella guardata.';
