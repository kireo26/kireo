-- LA NOTA DI REVISIONE LA LEGGE CHI LA RICEVE (Mario, 27/10) — migrazione G1 di due.
--
-- IL CASO: `eventi_select_approvati` non limita le colonne, quindi la nota di
-- revisione di un evento APPROVATO la legge chiunque veda gli eventi pubblici,
-- studenti compresi. Il campo dell'admin prometteva «visibile all'ente», e la
-- frase era falsa nei due versi: l'ente non la leggeva da nessuna parte (fino
-- al 27/10), e gli estranei sì. «"Visibile all'ente" non è solo una promessa su
-- chi vede: è un'affermazione su chi non vede.» È la specie della porta del
-- 26/10 (il trigger che guardava l'update e non l'insert): una protezione che
-- copre un modo di arrivare e non l'altro.
--
-- ⚠️ PERCHÉ NON BASTA UN PRIVILEGIO DI COLONNA: i privilegi sono per RUOLO, non
-- per riga. Lo studente e l'ente sono tutti e due `authenticated`, quindi
-- togliere la colonna ad `authenticated` la toglierebbe anche all'ente, cioè
-- all'unico che deve leggerla. La forma è quella delle ore (`20261029100000`):
-- la colonna esce dalla lettura del client (G2), e chi ne ha diritto la legge
-- da una funzione che decide per riga.
--
-- CHI NE HA DIRITTO: l'admin, e l'organizzatore dell'evento. Nessun altro, in
-- nessuno stato: per chi non c'entra la funzione semplicemente non restituisce
-- la riga (assente non è «senza nota»: chi legge tiene i due casi distinti).
--
-- I TRE TEMPI, come C/D: questa aggiunge la funzione e non toglie niente (il
-- codice di oggi legge ancora la colonna); il deploy porta le letture alla
-- funzione; `20261101110000` (G2) toglie la colonna alla lettura del client.
-- G2 prima del deploy romperebbe l'elenco dell'ente e la pagina dell'evento,
-- che oggi la nominano nella `select`.
--
-- COME SI VERIFICA APPLICATA: `to_regprocedure('public.note_revisione_eventi(uuid[])')`
-- non è null — la crea solo questa migrazione.

create or replace function public.note_revisione_eventi(p_ids uuid[])
returns table (evento_id uuid, note_revisione text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.note_revisione
  from public.eventi e
  where e.id = any(p_ids)
    and (
      public.current_ruolo() = 'admin'
      or (e.organizzatore_id is not null and e.organizzatore_id = public.current_istituzione_id())
    )
$$;

revoke all on function public.note_revisione_eventi(uuid[]) from public, anon;
grant execute on function public.note_revisione_eventi(uuid[]) to authenticated;

comment on function public.note_revisione_eventi(uuid[]) is
  '20261101100000: la nota di revisione degli eventi chiesti, solo per l''admin e per l''organizzatore. Una riga assente vuol dire «non tua», non «senza nota».';
