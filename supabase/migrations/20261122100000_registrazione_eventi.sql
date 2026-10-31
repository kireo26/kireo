-- LA REGISTRAZIONE DI UNA DIRETTA SI RIVEDE, SOLO SE QUALCOSA HA VISTO CHE PARTE
-- (Mario, 31/10).
--
-- La misura che ha deciso il ramo: il 31/10 Mario ha lanciato il banco del
-- player (`npm run banco player 5doxLWDlAJU`) sulla diretta del 5/10, finita da
-- tre settimane: «pronto · fermo · in riproduzione», nel PlayerDiretta vero e
-- senza ripiego. La registrazione di una diretta conclusa si incorpora con lo
-- STESSO id. Quindi nessun campo nuovo per il video: l'id è quello della
-- diretta.
--
-- ⚠️ La portata di quella misura: un video, di un ente, archiviato. Dice che la
-- strada esiste, non che vale per tutti. Un ente può non archiviare la diretta,
-- renderla privata o cancellarla, e un link che smette di funzionare lo fa in
-- silenzio. Per questo il bottone «Rivedi» NON dipende dall'id: dipende da
-- `registrazione_esito = 'disponibile'`, che scrive solo la sonda del server
-- (lib/eventi/sondaRegistrazione.ts, dal cron giornaliero), una volta, a
-- diretta finita da un po'. *Senza la sonda abbiamo un indirizzo; con la sonda
-- abbiamo una registrazione.*
--
-- Gli esiti:
--   disponibile        — YouTube dice che il video esiste ed è incorporabile;
--   non_incorporabile  — esiste, ma l'incorporamento è spento;
--   non_trovata        — privato, cancellato, o un id che non è più un video;
--   non_controllato    — la sonda non ha avuto una risposta (rete, un codice
--                        inatteso): si riprova al giro dopo.
-- NULL = la sonda non è ancora passata. Nessuno dei quattro è una colpa
-- dell'ente: sono un fatto su un video.
--
-- ⚠️ RIVEDERE NON È ESSERCI: queste colonne non toccano presenze né ore, e la
-- pagina che le usa non manda battiti (`npm run test:rivedi` lo vieta).
--
-- Il client le legge e non le scrive: la tabella non è scrivibile dal client se
-- non per le colonne del registro (20261106100000), e queste non ci sono. La
-- sonda scrive con la service role.

alter table public.eventi
  add column registrazione_esito text
    check (registrazione_esito in ('disponibile', 'non_incorporabile', 'non_trovata', 'non_controllato')),
  add column registrazione_sondata_il timestamptz;

alter table public.eventi
  add constraint eventi_registrazione_sondata_con_data
    check ((registrazione_esito is null) = (registrazione_sondata_il is null));

comment on column public.eventi.registrazione_esito is
  '20261122100000: cosa ha visto la sonda del server sulla registrazione della diretta (stesso id del video). Il bottone «Rivedi» compare solo con disponibile. Non tocca presenze né ore.';

-- Leggibile come il resto delle colonne pubbliche di un evento (20261101110000).
grant select (registrazione_esito, registrazione_sondata_il) on public.eventi to anon, authenticated;

do $$
begin
  if not has_column_privilege('anon', 'public.eventi', 'registrazione_esito', 'SELECT') then
    raise exception 'l''esito della registrazione non si legge senza accesso';
  end if;
  if has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'UPDATE')
     or has_column_privilege('authenticated', 'public.eventi', 'registrazione_esito', 'INSERT') then
    raise exception 'il client scrive l''esito della registrazione';
  end if;
end $$;
