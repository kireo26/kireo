-- KIREO — un ruolo di workshop non è più esclusivo.
--
-- COSA C'ERA, E PERCHÉ ESCE.
--
--   create unique index workshop_iscrizioni_ruolo_attivo_idx
--     on public.workshop_iscrizioni (ruolo_id)
--     where stato = 'attivo';
--
-- con sopra questo commento: «Posto singolo per ruolo: chiude la finestra di
-- corsa fra due studenti che scelgono lo stesso ruolo quasi simultaneamente».
--
-- LA GIUSTIFICAZIONE NON REGGEVA IL VINCOLO. Una guardia contro la corsa fra
-- due clic è `unique (student_id, workshop_id)`: impedisce che LA STESSA
-- PERSONA finisca iscritta due volte per una doppia richiesta. Quello che
-- c'era scritto invece — `unique (ruolo_id)` — non protegge da nessuna corsa:
-- stabilisce che quel ruolo esiste una volta sola al mondo. Il commento
-- nominava la prima cosa mentre il codice ne imponeva un'altra, e nessuno
-- l'aveva mai decisa: non c'è traccia di quella scelta da nessuna parte.
--
-- Ci abbiamo poi costruito sopra — il badge «Occupato» nella scelta ruolo, la
-- riga «Un ruolo per persona» nei cinque passi, due sere di ragionamenti su
-- edizioni e gruppi — difendendola come se fosse il senso del prodotto.
--
-- IL PRINCIPIO CHE LA CHIUDE: ogni studente che è arrivato a quel punto del
-- percorso deve poter fare il workshop, indipendentemente dagli altri e da
-- quanti posti sono liberi. Uno che arriva da solo un martedì sera comincia
-- quel martedì sera. (Ed è per lo stesso motivo che non arriva nemmeno
-- l'edizione a gruppi: farebbe dipendere l'accesso dall'esistenza di un
-- gruppo, cioè ancora da altre persone.)
--
-- E NON SI PERDE NIENTE, perché il progetto a cinque non esiste nei dati:
-- `workshop_elaborati` ha una riga per iscrizione, il revisore legge un
-- elaborato solo, il feedback finale giudica un ruolo solo, il punteggio va
-- sull'area di quello studente. Non c'è nessun documento comune e nessuna
-- consegna congiunta. L'unica cosa che i cinque ruoli condividono davvero è
-- la lista dei compagni con la chat (`peers_workshop` /
-- `invia_messaggio_rete_workshop`), che continua a funzionare identica —
-- anzi, adesso può capitare di trovare qualcuno che sta facendo il TUO stesso
-- ruolo, che è la conversazione più utile che quella chat possa ospitare.
--
-- L'esclusività non proteggeva una collaborazione: proteggeva una scarsità
-- che non serviva a nessuno, e che teneva l'intera piattaforma a
-- venticinque studenti.

drop index if exists public.workshop_iscrizioni_ruolo_attivo_idx;

-- Il vincolo totale su (workshop_id, student_id) esce insieme all'altro: era
-- più stretto di quello che serve, e impediva a chi si ritira di ripartire su
-- un ruolo diverso dello stesso workshop. La sostituisce la versione
-- PARZIALE, che è esattamente la guardia che il vecchio commento diceva di
-- volere: una sola iscrizione ATTIVA per studente e workshop.
alter table public.workshop_iscrizioni
  drop constraint if exists workshop_iscrizioni_workshop_id_student_id_key;

create unique index if not exists workshop_iscrizioni_studente_attiva_idx
  on public.workshop_iscrizioni (student_id, workshop_id)
  where stato = 'attivo';

comment on index public.workshop_iscrizioni_studente_attiva_idx is
  'Una sola iscrizione ATTIVA per studente e workshop: è la guardia contro la doppia iscrizione dello stesso studente (due clic, due richieste). Un ruolo invece lo possono fare quanti vogliono — l''esclusività per ruolo è uscita il 2026-08-30.';

-- La funzione resta, ma cambia significato: dice quali ruoli hanno almeno
-- un'iscrizione attiva, e non è più un impedimento. L'interfaccia di scelta
-- ruolo non la usa più per disabilitare niente.
comment on function public.ruoli_occupati_workshop(uuid) is
  'Quali ruoli di un workshop hanno almeno un''iscrizione attiva. NON è più un impedimento: dal 2026-08-30 un ruolo lo possono fare più studenti insieme. Semmai un''informazione (quanti stanno facendo cosa), mai un blocco.';
