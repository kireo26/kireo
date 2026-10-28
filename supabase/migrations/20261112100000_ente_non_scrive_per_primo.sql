-- L'ENTE NON SCRIVE PER PRIMO: una REGOLA, non un limite tecnico (Mario, 28/10).
-- Solo un commento sulla funzione, scritto dove verrebbe in mente di cambiarla.
--
-- La regola: una conversazione fra un ente e uno studente la apre sempre lo
-- studente, anche dopo che ha condiviso il profilo con quell'ente. L'ente
-- risponde (invia_messaggio_ente), non comincia.
--
-- La ragione: dall'altra parte ci sono quasi sempre minorenni, e l'ente è un
-- adulto con un interesse proprio. Una conversazione fra i due deve partire dal
-- minorenne. Condividere il profilo vuol dire «mi sono fatto vedere», non
-- «contattami»: trasformare il primo gesto nel secondo sarebbe decidere al posto
-- suo. È la stessa ragione per cui la pagina pubblica dell'ente non ha recapiti.
--
-- Come la tiene il codice: apri_conversazione_ente non ha un parametro per lo
-- studente (lo studente è chi chiama) e pretende uno studente
-- (pretendi_contatto_enti, `solo_studenti`); la prova è
-- scripts/verifica-gesti-dei-minorenni.sql §12. La scheda di un interessato
-- mostra il bottone «Scrivigli» solo dove una conversazione esiste già.
--
-- ⚠️ Chi volesse dare all'ente il primo messaggio non cambia un permesso:
-- rovescia questa regola, e la decisione è di Mario, con la sua ragione legale.

comment on function public.apri_conversazione_ente(uuid, text) is
  '20261112100000: REGOLA, non limite tecnico. La conversazione con un ente la apre sempre lo studente, anche dopo aver condiviso il profilo: fra un adulto con un interesse proprio e un minorenne il primo messaggio è del minorenne, e «mi sono fatto vedere» non vuol dire «contattami». L''ente risponde con invia_messaggio_ente. Cambiarla è una decisione di Mario, non un permesso da allargare.';

-- La rilettura: il commento c'è, e nomina questa migrazione.
do $$
begin
  if coalesce(obj_description('public.apri_conversazione_ente(uuid, text)'::regprocedure, 'pg_proc'), '') not like '20261112100000:%' then
    raise exception 'il commento su apri_conversazione_ente non è atterrato';
  end if;
end $$;
