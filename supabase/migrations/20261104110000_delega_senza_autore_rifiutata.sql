-- UNA DELEGA CAMBIATA SENZA AUTORE SI RIFIUTA (Mario, 27/10).
--
-- `tieni_traccia_delega_permessi` (20260715110000) scrive chi ha cambiato i
-- permessi di un membro dello staff di una scuola: `delega_aggiornata_da =
-- auth.uid()`. Senza una sessione (il SQL Editor, la service-role) `auth.uid()`
-- è NULL, e la scrittura atterrava con autore NULL. *Un registro esiste per
-- rispondere a una domanda sola — chi è stato. Una riga che dice «nessuno» non è
-- un'informazione mancante: è una risposta falsa, perché qualcuno è stato per
-- forza.* E riguarda le deleghe dei permessi di una scuola, cioè la cosa per
-- cui un registro serve davvero.
--
-- ORA:
--   - con una sessione, come prima: l'autore è chi è collegato (un valore
--     scritto a mano viene sovrascritto, perché lì l'autore lo sappiamo);
--   - senza sessione, chi cambia una delega scrive l'autore a mano
--     (`delega_aggiornata_da`, un profilo vero); se non lo fa, o scrive NULL,
--     la scrittura si ferma con `autore_delega_mancante`. È un passo in più, e
--     vale esattamente quello che costa.
--
-- È lo stesso confine di `blocco_cambio_scuola_verificato`: fra i trigger che
-- guardano la sessione, quello che si ferma è l'unico di cui conosciamo il
-- limite con precisione, perché è lui a dircelo (vedi «La trappola del 30/08 era
-- anche altrove»).
--
-- Chi cambia una delega senza sessione oggi: nessuno nel codice
-- (`redeem_invito_staff` aggiorna `school_staff` ma non i permessi; i bottoni
-- della scuola scrivono dal client, con la sessione). Resta il SQL Editor.
--
-- COME SI VERIFICA APPLICATA: `obj_description('public.tieni_traccia_delega_permessi()'::regprocedure)`
-- nomina 20261104110000 (lo scrive solo questa migrazione).

create or replace function public.tieni_traccia_delega_permessi()
returns trigger
language plpgsql
as $$
begin
  if new.puo_verificare_studenti is distinct from old.puo_verificare_studenti
     or new.puo_gestire_classi is distinct from old.puo_gestire_classi
     or new.puo_certificare_presenze is distinct from old.puo_certificare_presenze
     or new.puo_inviare_comunicazioni is distinct from old.puo_inviare_comunicazioni
  then
    if auth.uid() is not null then
      new.delega_aggiornata_da := auth.uid();
    elsif new.delega_aggiornata_da is null
       or new.delega_aggiornata_da is not distinct from old.delega_aggiornata_da then
      -- Senza sessione l'autore lo scrive chi cambia la delega, e dev'essere
      -- un valore nuovo: quello di prima è l'autore della delega di prima.
      raise exception 'autore_delega_mancante'
        using hint = 'Senza una sessione, scrivi anche delega_aggiornata_da con il profilo di chi ha deciso il cambio.';
    end if;
    new.delega_aggiornata_il := now();
  end if;

  return new;
end;
$$;

comment on function public.tieni_traccia_delega_permessi() is
  '20261104110000: registra chi ha cambiato una delega dello staff. Con una sessione è chi è collegato; senza (SQL Editor) chi scrive deve indicare delega_aggiornata_da, altrimenti autore_delega_mancante.';
