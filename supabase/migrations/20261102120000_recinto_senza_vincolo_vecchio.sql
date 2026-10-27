-- IL VECCHIO VINCOLO DI `recinto_enti` ESCE (Mario, 27/10) — migrazione J2 di due.
--
-- Vedi J1 (`20261102110000`). `recinto_enti_unica` teneva una riga sola per
-- studente ed ente, e scartava in silenzio il download di una guida fatto da
-- chi si era già iscritto a un evento. Il vincolo nuovo per origine c'è da J1.
--
-- ⚠️ SI APPLICA DOPO IL DEPLOY, mai prima: il codice di prima scrive con
-- `onConflict: "student_id,istituzione_id"`, e senza un vincolo su quelle due
-- colonne PostgREST rifiuta la scrittura (nessun vincolo corrisponde). Il codice
-- nuovo scrive sul vincolo per origine, che esiste da J1.
--
-- COME SI VERIFICA APPLICATA: `recinto_enti_unica` non è più in `pg_constraint`.

alter table public.recinto_enti drop constraint recinto_enti_unica;

comment on table public.recinto_enti is
  '20261102120000: quali istituzioni «conoscono» (in aggregato) uno studente, e da quale gesto: una riga per studente, ente e origine (guida, newsletter, evento), scritta da segnaNelRecinto (lib/app/recinto.ts). Nessuna policy per il ruolo istituzione: l''ente vede solo gli aggregati di stats_istituzione.';
