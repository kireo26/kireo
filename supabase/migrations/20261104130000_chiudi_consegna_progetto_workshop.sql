-- LA CONSEGNA FINALE DEL PROGETTO DAL CLIENT ESCE (Mario, 27/10). La sua unica
-- chiamante era `app/api/workshop/elaborato/consegna`, che nessun componente
-- chiamava più dal 29/08 (la chiusura del progetto la fa il cron sull'ultima
-- tappa, con `avanza_fase_workshop`) e che è uscita dal repo nello stesso
-- commit di questa migrazione: rispondeva a chiunque avesse una sessione e
-- un'iscrizione, e ogni risposta chiamava un modello a pagamento.
--
-- La funzione era l'altra metà della stessa porta, senza la spesa e senza
-- nemmeno la route: `authenticated` la eseguiva via RPC, e per la propria
-- iscrizione scriveva `stato = 'consegnato'`, `feedback_ai` col jsonb passato
-- dal chiamante e `consegnato_at`. Cioè uno studente poteva dichiarare
-- consegnato un progetto a qualunque tappa, con un feedback scritto da sé, e
-- sovrascrivere quello vero del cron; e `lib/percorso/stato.ts` conta
-- `stato = 'consegnato'` come workshop fatto. *Un gestore che risponde è un
-- gestore che qualcuno può far rispondere* (Mario): lo stesso vale per una
-- funzione con il grant a `authenticated`.
--
-- NON tocca dati: le righe già scritte restano. Quante ne abbia scritte questa
-- strada non si può più distinguere (scriveva le stesse colonne del cron).
--
-- COME SI VERIFICA APPLICATA: `to_regprocedure('public.consegna_progetto_workshop(uuid, jsonb)')`
-- è null. La migrazione si ferma da sé se dopo il drop la funzione c'è ancora.

drop function if exists public.consegna_progetto_workshop(uuid, jsonb);

do $$
begin
  if to_regprocedure('public.consegna_progetto_workshop(uuid, jsonb)') is not null then
    raise exception 'consegna_progetto_workshop esiste ancora dopo il drop';
  end if;
end $$;
