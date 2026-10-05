-- ⚠️⚠️ QUINTA FALLA DELLA STESSA SPECIE, E I DATI ESPOSTI SONO DI UNA MINORENNE.
-- Verificata per esecuzione su una replica con tutte le migrazioni, non
-- leggendo le policy.
--
-- LA CATENA, due scritture dalla porta normale del client:
--
--   1. `update profiles set ruolo = 'docente' where id = auth.uid()`
--      Passa: il ruolo è self-service di proposito (solo `admin` è bloccato, e
--      `referente_scuola` lo era fino al 15/07 — vedi 20260715110000, dove fu
--      aperto con la ragione scritta «il ruolo da solo non apre nessuna porta»).
--
--   2. `insert into teacher_profiles (user_id, school_code, materia)
--       values (auth.uid(), '<una scuola qualunque>', 'Matematica')`
--      Passa: `teacher_profiles_insert_own` è `with check (user_id =
--      auth.uid())` — verifica DI CHI è la riga, non DI QUALE SCUOLA.
--
-- E da quel momento `current_school_code()` restituisce QUELLA SCUOLA, perché
-- per un docente legge esattamente quella colonna.
--
-- MISURATO, non dedotto. Con quelle due scritture un account qualunque legge,
-- di una scuola con cui non ha nessun rapporto:
--
--   • NOME E COGNOME dei suoi studenti          (profiles_select_school_students)
--   • scuola, classe, stato di verifica          (student_profiles_select_school)
--   • LE LORO AREE DI INTERESSE                  (student_area_interests_select_school)
--   • le ore PCTO certificate                    (student_activities_select_school)
--   • le convenzioni e i codici classe           (conventions_select_school, class_codes_select_school)
--
-- e, con `ruolo = 'referente_scuola'` al passo 1, CREA codici classe per quella
-- scuola (`class_codes_insert_referente`) — cioè la chiave con cui altri
-- studenti si attaccano a lei.
--
-- Nella prova lo studente letto era nato nel 2010.
--
-- ══════ IL DIFETTO NON È LA SCRITTURA: È CHE UNA DICHIARAZIONE NON VERIFICATA
-- ══════ VIENE TRATTATA COME UN TITOLO.
--
-- Dichiarare una scuola è self-service DI PROPOSITO, per il docente come per lo
-- studente: `finalize_registration` prende `p_school_code` libero dal client, e
-- `DocenteForm` lo fa compilare. Per lo studente è innocuo — quella
-- dichiarazione non gli dà nessun diritto, gli espone solo la propria email a
-- quella scuola (scelta accettata: il referente ne ha bisogno per decidere se
-- verificarlo). Per il docente la stessa dichiarazione, senza nessuna verifica
-- da parte di nessuno, DIVENTA UN PERMESSO DI LETTURA sui dati dei minori di
-- quella scuola.
--
-- Quindi la cura non sta sulla scrittura — chiudere l'insert romperebbe il
-- signup del docente, e `finalize_registration` è SECURITY INVOKER di proposito
-- (la sua INVOKER-ness è la rete che impedisce l'auto-elevazione: vedi
-- 20260711140000). Sta dove il permesso viene CONCESSO: si tolgono le policy
-- che trattano `current_school_code()` come un titolo. Così la dichiarazione
-- resta libera e non apre niente — per qualunque percorso di scrittura, oggi e
-- domani.
--
-- ══════ LA VIA VERIFICATA ESISTE DA LUGLIO, ED È UN'ALTRA ══════
--
-- L'area scuola (Fase 5, luglio) ha sostituito questo percorso: `scuole_profili`
-- con lo stato attivato A MANO da un admin in due stadi, `school_staff` con il
-- referente e i tutor, i permessi delegabili, e le policy che guardano
-- `current_ruolo_staff()` / `current_scuola_id()`. Lì una riga di `school_staff`
-- non si può inserire da sé: serve un referente già esistente, ed è una
-- circolarità chiusa. Le policy che si toccano qui sono il residuo della Fase 2,
-- rimasto vivo accanto alla via nuova.
--
-- ⚠️ E NESSUNA SUPERFICIE DELL'APP LE USA. [verificato su app/, components/,
-- lib/: l'area docente legge solo la PROPRIA riga di `teacher_profiles`
-- (`lib/docente/context.ts`, materia e school_code, per mostrarle); nessuna
-- pagina legge `student_profiles`, `student_area_interests` o
-- `student_activities` con il ruolo docente; nessuna superficie crea codici
-- classe o legge le convenzioni — `class_codes` e `conventions` non compaiono
-- in nessun file dell'app.] Hanno zero consumatori legittimi, come le policy di
-- scrittura chiuse il 4/10 su `institution_profiles` e `student_activities`.
--
-- COSA NON TOCCA. Le letture dello staff scuola verificato (`*_select_scuola`,
-- `*_select_scuola_staff`, `email_studenti_scuola`) restano tutte: sono la via
-- nuova e passano da `school_staff.attivo`. E il docente continua a leggere la
-- propria riga: `teacher_profiles_select_own` non si tocca.
--
-- ⚠️ SE UN GIORNO UN DOCENTE DOVRÀ VEDERE I PROPRI STUDENTI, la strada è quella
-- verificata — una riga in `school_staff`, che un referente crea — non la
-- riapertura di queste. Una dichiarazione non diventa un titolo nemmeno allora.

-- ─────────────── i profili degli studenti: nome e cognome
drop policy if exists profiles_select_school_students on public.profiles;

-- ─────────────── scuola, classe, stato di verifica
drop policy if exists student_profiles_select_school on public.student_profiles;

-- ─────────────── LE AREE DI INTERESSE: dato di profilazione, il peggiore dei sei
drop policy if exists student_area_interests_select_school on public.student_area_interests;

-- ─────────────── le ore PCTO certificate
drop policy if exists student_activities_select_school on public.student_activities;

-- ─────────────── la convenzione della scuola
drop policy if exists conventions_select_school on public.conventions;

-- ─────────────── i codici classe: leggerli, e CREARLI
drop policy if exists class_codes_select_school on public.class_codes;
drop policy if exists class_codes_insert_referente on public.class_codes;
drop policy if exists class_codes_update_referente on public.class_codes;
drop policy if exists class_codes_delete_referente on public.class_codes;

-- `check_class_code` e `redeem_class_code` NON si toccano: sono SECURITY
-- DEFINER e scavalcano la RLS, quindi uno studente continua a riscattare il
-- codice che la sua scuola gli ha dato. Quello che non si può più è FABBRICARNE
-- uno per una scuola che si è soltanto dichiarata.

comment on table public.teacher_profiles is
  'Profilo docente: la scuola DICHIARATA (self-service, come per lo studente) '
  'e la materia. ⚠️ LA DICHIARAZIONE NON È UN TITOLO: fino al 5/10 otto policy '
  'trattavano `current_school_code()` — che per un docente legge questa '
  'colonna — come un permesso di lettura sui dati degli studenti di quella '
  'scuola, e con due scritture dal client (darsi il ruolo docente, dichiarare '
  'una scuola qualunque) un account qualunque leggeva nome, cognome, classe e '
  'AREE DI INTERESSE di minori. La via verificata e'' `school_staff` + '
  '`scuole_profili`, attivata a mano da un admin: se un docente dovra'' vedere '
  'i propri studenti, si passa da la''. Nessuna policy di scrittura qui e'' '
  'vincolata nel contenuto, e non serve che lo sia: la dichiarazione non apre '
  'niente.';

comment on table public.class_codes is
  'Codici con cui uno studente si collega alla propria classe. Si RISCATTANO '
  'via check_class_code/redeem_class_code (SECURITY DEFINER, scavalcano la '
  'RLS). ⚠️ NESSUNA SCRITTURA NE'' LETTURA DAL CLIENT dal 5/10: le quattro '
  'policy `*_referente` guardavano `current_school_code()`, cioe'' una scuola '
  'che un utente poteva solo DICHIARARE — quindi chiunque potesse darsi il '
  'ruolo referente_scuola fabbricava codici per una scuola qualunque. Nessuna '
  'superficie dell''app le usava. La gestione dei codici, se servira'', passa '
  'dalla via verificata (school_staff).';

comment on table public.conventions is
  'Convenzione PCTO fra KIREO e una scuola. ⚠️ NESSUNA LETTURA DAL CLIENT dal '
  '5/10: `conventions_select_school` guardava `current_school_code()`, una '
  'scuola dichiarabile da chiunque. Lo stato della scuola nella Fase 5 vive in '
  '`scuole_profili` (attivazione admin in due stadi), e l''area scuola legge '
  'quella.';
