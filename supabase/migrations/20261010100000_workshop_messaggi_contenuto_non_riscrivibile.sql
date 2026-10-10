-- Il censimento delle cinque tabelle mute (10/10/2026), e l'unica cura che
-- non poteva aspettare la passata unica.
--
-- LE CINQUE, guardate per esecuzione sulle tre domande — cosa può scrivere il
-- client, cosa concede quello che scrive, chi lo legge:
--
--   messaggi_enti      🟢  nessuna policy di scrittura: ogni scrittura passa
--                          da invia_messaggio_ente / segna_messaggio_letto
--   workshop           🟢  solo admin in scrittura, lettura dei soli attivi
--   workshop_ruoli     🟢  idem — e quindi `area_slug`, cioè l'area su cui
--                          finisce il credito di fine progetto, non si sposta
--   workshop_consegne  🟡  l'insert è ancorato alla propria iscrizione, ma
--                          NON vincola `feedback_ai`: il client si scrive da
--                          sé il giudizio. Oggi non ha lettori — l'unico che
--                          legge quella tabella è lib/percorso/stato.ts, che
--                          seleziona il solo `iscrizione_id` — quindi va
--                          nella passata unica, non qui: è la specie «una
--                          riga che oggi non ha lettori, e domani ne avrà».
--   workshop_messaggi  🔴  IL DESTINATARIO RISCRIVE LE PAROLE DEL MITTENTE.
--
-- LA FALLA, misurata e non dedotta. `workshop_messaggi_update_letto` è
-- `using (destinatario_id = auth.uid())` con lo stesso `with check`: ancora
-- CHI può aggiornare, e non COSA. Luca, destinatario, fa
--
--     update workshop_messaggi set contenuto = 'MAI DETTO DA ANNA'
--
-- e passa; Anna rilegge il proprio messaggio (`mittente_id = auth.uid()`) e
-- trova parole che non ha scritto. Non c'è nemmeno la barriera dell'uuid
-- indovinabile che rende poco urgenti le altre della stessa specie: il
-- destinatario conosce legittimamente l'id di un messaggio indirizzato a lui
-- — la chat glielo rende, e `NetworkPeers` ci chiama sopra un update per
-- segnarlo come letto.
--
-- Per questo si cura adesso invece di aspettare: sono dati di un terzo, e il
-- terzo è un altro minorenne.
--
-- PERCHÉ LA CURA È UN POSTO E NON UNA CLAUSOLA. In RLS `using` vede la riga
-- VECCHIA e `with check` la NUOVA, e non si possono confrontare: «questa
-- colonna non è cambiata» non è esprimibile in una policy. (Stessa ragione
-- già scritta per l'update di messaggi_scuola_destinatari, che non riesce a
-- inchiodare il proprio `messaggio_id`.) Quindi si scende di un livello: i
-- privilegi di COLONNA, che sono indipendenti dalla RLS e si applicano a
-- chiunque passi da quella porta — compreso il ramo che nessuno ha ancora
-- scritto. La policy continua a decidere QUALI righe, il privilegio decide
-- QUALI colonne.
--
-- ⚠️ L'APPOGGIO VA DICHIARATO, O NON È UNA DIFESA. Questa cura regge perché
-- su questa tabella NESSUNA policy di update serve ad altri che al
-- destinatario: l'unica policy di admin qui è `workshop_messaggi_admin_select`
-- — di sola LETTURA — quindi togliere l'update di colonna ad `authenticated`
-- non acceca nessun admin. È la trappola già pagata in Fase 1 ente, dove un
-- `revoke update` di colonna su `istituzioni` avrebbe bloccato anche chi
-- doveva poter scrivere, perché `authenticated` è il ruolo condiviso da OGNI
-- utente collegato. Se un domani nascerà qui una policy di update per l'admin
-- o per lo staff, questa revoca va rivista PRIMA, non dopo.
--
-- E `invia_messaggio_rete_workshop` non è toccata: è SECURITY DEFINER, gira
-- come proprietario, e i privilegi di colonna di `authenticated` non la
-- riguardano.

-- La revoca nomina i ruoli invece di affidarsi a `from public`: i default
-- privileges di Supabase concedono esplicitamente ad `anon` e `authenticated`,
-- e un `revoke … from public` non li toglie (lezione del 19/09, pagata su
-- registra_guasto).
revoke update on table public.workshop_messaggi from public, anon, authenticated;

-- L'unica colonna che il destinatario deve poter muovere. `anon` non la
-- riprende: non passa comunque dalla policy, che è `to authenticated`, e una
-- porta che non serve a nessuno resta chiusa.
grant update (letto) on table public.workshop_messaggi to authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- I commenti delle cinque: non sono documentazione, sono la RICEVUTA DELLO
-- SGUARDO. Il censimento del silenzio è nato da una statistica — tutte e
-- cinque le falle del 4-5/10 erano in tabelle che non dichiaravano la propria
-- regola, nessuna in una tabella che la dichiarava — e la ragione non è che
-- il commento protegga: è che la sua assenza è la traccia di uno sguardo che
-- non c'è stato. Queste cinque adesso sono state guardate.

comment on table public.messaggi_enti is
  'Messaggi di una conversazione studente↔ente. NESSUNA policy di scrittura per il client: ogni scrittura passa da invia_messaggio_ente (che decide da auth.uid() chi sta scrivendo e pretende un piano a pagamento per l''ente) e da segna_messaggio_letto. Lettura: i due partecipanti e l''admin. Verificato per esecuzione il 10/10/2026: dal client un insert è respinto e un update del corpo non tocca nessuna riga.';

comment on table public.workshop is
  'Catalogo dei progetti workshop. Scrittura solo admin; lettura dei soli `attivo` (più tutto per l''admin). Il client non può né crearne uno né riaccendere uno spento — verificato per esecuzione il 10/10/2026.';

comment on table public.workshop_ruoli is
  'I ruoli di un progetto workshop. Scrittura solo admin. `area_slug` è una delle 18 aree ufficiali e decide su quale area finisce il credito di fine progetto (activity_log, tipo workshop_progetto): per questo il client non deve poterlo spostare, e non può — verificato per esecuzione il 10/10/2026. `slug` è invece la chiave del kit materiali in lib/workshop/config.ts: due cose diverse, non confonderle.';

comment on table public.workshop_consegne is
  'Le consegne file del motore workshop v1 (append-only: nessun update, nessun delete — una revisione è una nuova consegna). Il punto di ingresso è chiuso dal 29/08/2026 e la route risponde 410, ma la tabella resta perché ha_esperienza_percorso e lib/percorso/stato.ts la leggono: chi aveva consegnato in v1 non retrocede nel percorso. ⚠️ L''insert è ancorato alla propria iscrizione ma NON vincola `feedback_ai`: un client si scrive da sé il giudizio. Oggi nessuno legge quella colonna (lib/percorso/stato.ts seleziona il solo `iscrizione_id`), quindi la cura va nella passata unica del censimento — vedi la migrazione 20261010100000.';

comment on table public.workshop_messaggi is
  'Messaggi fra compagni dello stesso workshop. Scrittura solo via invia_messaggio_rete_workshop, che verifica che mittente E destinatario siano entrambi iscritti attivi allo stesso workshop (senza quel controllo sarebbe una messaggistica libera fra qualunque coppia di studenti della piattaforma) e applica un tetto di 30 al giorno. Il destinatario può muovere SOLO `letto`, e non per una clausola della policy ma per un privilegio di colonna: una policy non può dire «questa colonna non è cambiata». Prima del 10/10/2026 poteva riscrivere `contenuto`, cioè le parole del mittente, che le rileggeva alterate.';
