-- Le ore PCTO «registrate dalla scuola» escono (01/11, passo 2 del capitolo
-- della scuola; decisione di Mario).
--
-- COSA C'ERA. `activities` (un catalogo) e `student_activities` (le ore di uno
-- studente su un'attività) sono nate il 10/07 «predisposte per il futuro, solo
-- struttura». Non le ha mai scritte nessuno: nessun codice, nessuna funzione,
-- nessuna policy di scrittura (le due dello studente sono uscite il 4/10,
-- 20261004180000). Le leggevano tre cose: la somma del PCTO dello studente
-- (`getOreCertificate`), lo storico di «Le mie attività» e «Scarica i miei
-- dati», che le dichiarava vuote per tutti. In produzione: 0 attività, 0 ore
-- (Mario, 01/11, `scripts/diagnostica-area-scuola.sql`).
--
-- PERCHÉ ESCONO (Mario): il PCTO di uno studente era una somma fra un numero
-- vero (le presenze certificate) e una finzione. Oggi la finzione vale zero, e
-- il giorno in cui qualcuno ci scrivesse dal SQL Editor le ore di uno studente
-- cambierebbero senza che si sappia da dove. Le ore vengono da una cosa sola:
-- `iscrizioni_eventi.ore_riconosciute`, emessa da chi certifica.
--
-- ⚠️ LA DAD NON PASSA DI QUI [letto, 01/11]: una scuola che trasmette un evento
-- in aula e certifica le presenze passa da `certifica_presenza`, che scrive
-- `iscrizioni_eventi.ore_riconosciute`. L'unica chiave verso `activities` era
-- quella di `student_activities`; nessuna vista e nessuna funzione dipende
-- dalle due tabelle (misurato su una replica con tutte le migrazioni:
-- `pg_depend` dà solo i loro vincoli e la loro policy).
--
-- IL FATTO CHE LE FAREBBE RIAPRIRE: una scuola che chiede di registrare ore
-- fatte fuori da KIREO. Quel giorno è un prodotto diverso, con chi certifica
-- cosa, e nasce con tabelle sue: non si ripescano queste.
--
-- SI FERMA SE TROVA UNA RIGA. «Nessuno le scrive» è una lettura del codice;
-- quello che c'è nella tabella lo dice solo la tabella. Una riga vuol dire che
-- qualcuno ci ha scritto per un'altra strada, e prima di buttarla si guarda.

do $$
declare
  v_attivita bigint;
  v_ore bigint;
begin
  select count(*) into v_attivita from public.activities;
  select count(*) into v_ore from public.student_activities;
  if v_attivita <> 0 or v_ore <> 0 then
    raise exception '20261129100000: activities ha % righe e student_activities %: prima di toglierle si guarda chi le ha scritte', v_attivita, v_ore;
  end if;
end $$;

drop table public.student_activities;
drop table public.activities;
drop type public.student_activity_status;

-- si rilegge
do $$
begin
  if to_regclass('public.student_activities') is not null or to_regclass('public.activities') is not null then
    raise exception '20261129100000: le tabelle delle ore della scuola ci sono ancora';
  end if;
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typname = 'student_activity_status') then
    raise exception '20261129100000: il tipo student_activity_status c''è ancora';
  end if;
end $$;
