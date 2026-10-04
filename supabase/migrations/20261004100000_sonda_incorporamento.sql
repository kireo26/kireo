-- LA MISURA AL POSTO DELLA DICHIARAZIONE.
--
-- Fino al 4/10 un evento su `hosting_diretta='proprio'` doveva portare, nel
-- jsonb `checklist_diretta`, la voce `incorporamento_attivo`: una SPUNTA con
-- cui l'ente dichiarava di aver verificato che il suo video si potesse
-- incorporare. Noi la registravamo come un fatto. Il 4/10 è arrivato il
-- conto: aperta la pagina della diretta, al posto del video c'era «La
-- riproduzione su altri siti web è stata disattivata dal proprietario del
-- video» — e nessuno lo aveva detto a nessuno.
--
-- Adesso quella cosa si MISURA (IFrame API, errore 101/150 quando il
-- proprietario ha disattivato l'incorporamento: nessuna chiave, nessuna
-- chiamata a pagamento). Vedi lib/sondaYoutube.ts per i quattro esiti e per
-- la ragione del confine fra `non_disponibile` e `non_controllato`.
--
-- COSA CAMBIA QUI, e perché non si poteva solo togliere la spunta: il CHECK
-- `eventi_diretta_proprio_coerente` PRETENDE la chiave
-- `incorporamento_attivo` dentro il jsonb (`?` è esistenza di chiave), quindi
-- un evento creato senza quella dichiarazione sarebbe stato rifiutato dal
-- database. Il vincolo nuovo chiede la stessa cosa in un modo più vero: la
-- domanda sull'incorporamento deve essere stata RISPOSTA — da una misura
-- nostra oppure, se la misura non si è potuta fare, da una dichiarazione
-- dell'ente. Mai da nessuna delle due.
--
-- È un vincolo PIÙ FORTE di quello di prima, non più debole: prima bastava
-- una spunta, e una spunta la si dà anche sbagliando; adesso un evento in cui
-- la sonda ha detto «l'incorporamento è disattivato» e l'ente non ha
-- dichiarato niente viene rifiutato qui, non solo dal form.
--
-- NESSUN CHECK SUL DOMINIO DI `incorporamento_sonda`, ed è deliberato (stesso
-- principio già scritto per `guasti.specie`): l'insieme degli esiti vive nel
-- tipo TypeScript `EsitoSonda`, dove un valore inventato lo ferma il
-- compilatore prima del deploy, e aggiungerne uno non richiede una
-- migrazione. Un CHECK troppo stretto qui rifiuterebbe un EVENTO, che è una
-- perdita peggiore di un valore inatteso in una colonna diagnostica. La
-- clausola nel vincolo nomina il solo valore affermativo (`'attivo'`), quindi
-- non è una seconda copia di `sondaBlocca`: qualunque altro esito, noto o
-- ignoto, non soddisfa la condizione.

alter table public.eventi
  add column if not exists incorporamento_sonda text;

comment on column public.eventi.incorporamento_sonda is
  'Esito della sonda sull''incorporamento del video al momento in cui il link è stato impostato (lib/sondaYoutube.ts: attivo | incorporamento_disattivato | non_disponibile | non_controllato). null = sonda mai eseguita su questo evento. Nessun CHECK sul dominio: l''insieme vive nel tipo TypeScript, e un CHECK stretto rifiuterebbe un evento invece di un valore.';

-- ⚠️ UN CHECK PASSA QUANDO VALE NULL, E IL VINCOLO DI LUGLIO AVEVA UN BUCO.
-- Settima volta in questo progetto che la specie è la stessa — la NULL che
-- fa non scattare una guardia — e la prima volta che è dentro un CHECK
-- invece che dentro un `if`.
--
-- [verificato, non dedotto, su una replica con le sole migrazioni fino al
-- 3/10]: `checklist_diretta` è nullable, `NULL ? 'non_in_elenco'` vale NULL,
-- e in una catena di AND un NULL sopravvive se tutto quello che lo precede è
-- vero — poi il CHECK, valendo NULL, ACCETTA la riga. Quindi dal 26 luglio un
-- evento con `hosting_diretta='proprio'`, un video, un
-- `checklist_diretta_accettata_il` e `checklist_diretta` a NULL passava senza
-- che nessuna voce della checklist fosse mai stata confermata. Provato: la
-- riga entra.
--
-- Lo stesso buco lo avrebbe avuto la clausola nuova (`incorporamento_sonda`
-- è nullable, quindi `NULL = 'attivo'` è NULL): lo ha trovato la proprietà 4
-- di scripts/verifica-sonda-e-chiave.sql, non una rilettura.
--
-- LA CURA È UNA SOLA E STA FUORI: `coalesce(<tutta la congiunzione>, false)`.
-- Avvolgere il singolo confronto chiuderebbe il buco di oggi e lascerebbe
-- quello di luglio, e soprattutto lascerebbe aperta la porta per il prossimo
-- conjunct nullable che qualcuno aggiungerà. `hosting_diretta` è NOT NULL
-- con default, quindi il primo disgiunto non ha bisogno di niente.
--
-- SE QUESTA `add constraint` FALLISCE, non è un difetto della migrazione: è
-- una riga che esisteva grazie al buco. Per trovarla:
--   select id, titolo, data_inizio from public.eventi
--   where hosting_diretta <> 'kireo'
--     and not coalesce(
--           youtube_video_id is not null
--           and checklist_diretta_accettata_il is not null
--           and checklist_diretta ? 'non_in_elenco'
--           and checklist_diretta ? 'chat_disattivata'
--           and checklist_diretta ? 'no_contenuti_terzi'
--           and (checklist_diretta ? 'incorporamento_attivo' or incorporamento_sonda = 'attivo'),
--         false);
-- Il vincolo si applica normalmente (non `not valid`) proprio per questo: una
-- migrazione che fallisce nominando il motivo è meglio di un `not valid` che
-- lascia la riga dentro senza dirlo a nessuno.
alter table public.eventi
  drop constraint if exists eventi_diretta_proprio_coerente;

alter table public.eventi
  add constraint eventi_diretta_proprio_coerente check (
    hosting_diretta = 'kireo'
    or coalesce(
      youtube_video_id is not null
      and checklist_diretta_accettata_il is not null
      and checklist_diretta ? 'non_in_elenco'
      and checklist_diretta ? 'chat_disattivata'
      and checklist_diretta ? 'no_contenuti_terzi'
      -- LA DOMANDA SULL'INCORPORAMENTO DEVE AVERE UNA RISPOSTA: la nostra
      -- misura, oppure la dichiarazione dell'ente quando la misura non si è
      -- potuta fare. Le due non stanno mai insieme a schermo (vedi
      -- `serveDichiarazioneIncorporamento`), quindi qui è un vero «oppure».
      and (
        checklist_diretta ? 'incorporamento_attivo'
        or incorporamento_sonda = 'attivo'
      ),
      false
    )
  );

comment on column public.eventi.checklist_diretta is
  'Per voce, il timestamp in cui l''ente l''ha confermata. La voce `incorporamento_attivo` è presente SOLO quando la sonda non ha potuto misurare l''incorporamento (vedi incorporamento_sonda): dove la misura c''è, non c''è nessuna dichiarazione da registrare, e registrarla sarebbe scrivere una dichiarazione che nessuno ha fatto.';
