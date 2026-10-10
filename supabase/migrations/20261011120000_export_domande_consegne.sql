-- DOMANDE E CONSEGNE NELL'EXPORT (11/10/2026)
--
-- ⚠️ IL DIFETTO: il CSV di una diretta ha solo le presenze. Quello che è stato
-- CHIESTO durante la diretta e quello che gli studenti hanno RISPOSTO alla
-- domanda finale non esce da nessuna parte — e la consegna è il pezzo del
-- formato che nessuno ha ancora letto: la prima non è mai arrivata, quella di
-- «test 2» è scaduta il 6 ottobre senza risposte.
--
-- I DUE VINCOLI SONO DI MARIO, e sono due cose diverse:
--
--   1. NIENTE NOMI su domande e consegne. Sulle presenze i nomi hanno una
--      ragione (la scuola certifica delle ore a delle persone); qui no. E la
--      proprietà non deve essere «la route non stampa quella colonna»: il ramo
--      `pubblico='studenti'` di `domande_live_organizzatore` non tocca nemmeno
--      `profiles`, cioè l'anonimato è STRUTTURALE — e passando da un CSV non si
--      perde. Da qui due funzioni dedicate che non nominano `profiles` in
--      NESSUN ramo, invece di riusare quella live e fidarsi di chi stampa.
--   2. Una sezione vuota deve DIRLO: zero domande e «non le abbiamo esportate»
--      si somigliano in un file aperto un mese dopo. Quella metà sta nel CSV
--      (`generaCsvSezioni` in `lib/csv.ts`), non qui.
--
-- ⚠️⚠️ LA CONSEGNA È LA PRIMA STRADA PER CUI IL TESTO DI UNO STUDENTE ESCE
-- DALLA SUA SESSIONE, e va detto invece di lasciarlo scoprire. `consegne_evento`
-- ha UNA SOLA policy, `select_own`: oggi nessun altro — né l'ente, né l'admin —
-- può leggere quei testi. Questa migrazione apre quella porta **solo
-- all'admin**, su richiesta esplicita di Mario (è il modo in cui leggerà le
-- prime consegne vere). L'ENTE RESTA FUORI, e non per dimenticanza: «quello che
-- scrivono resta loro, tu vedi solo che è arrivato» è una decisione del 27/09, e
-- l'ente ha già i due numeri che gli servono (`numero_domande` in
-- `report_evento_aggregato`, `risposte` in `stats_eventi_istituzione`).
--
-- ⚠️ IL LIMITE DELL'ANONIMATO, dichiarato perché nessuno lo scopra per caso:
-- togliere i nomi non rende le consegne non attribuibili quando i presenti sono
-- pochi. Se a un evento erano in due, chi legge il CSV ha due nomi nella sezione
-- delle presenze e due testi in quella delle consegne. Non si applica una
-- soglia di soppressione come in `report_evento_distribuzione` (k=5) perché lì
-- l'obiettivo era un aggregato, qui è leggere quello che i ragazzi hanno
-- scritto: sopprimere lo renderebbe inutile. Resta che a leggerlo è l'admin,
-- cioè chi i nomi li ha già nella stessa pagina.

-- ============ le domande, senza chi le ha scritte ============
-- Stessa autorizzazione di `domande_live_organizzatore` (admin O
-- l'organizzatore), perché è lo stesso dato che l'ente già vede nel pannello:
-- un CSV non gli aggiunge niente. Rami affermativi con `else raise`, come ogni
-- funzione di questa famiglia: un ruolo o un'istituzione NULL non entra in
-- nessuno dei due rami positivi, quindi è NULL-safe per costruzione.
create or replace function public.esporta_domande_evento(p_evento_id uuid)
returns table (
  creata_il timestamptz,
  testo text,
  stato text,
  toccata_da text,
  toccata_il timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
begin
  select e.organizzatore_id into v_organizzatore_id from public.eventi e where e.id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  -- ⚠️ NESSUN RAMO, e non è una semplificazione: `domande_live_organizzatore`
  -- ha due rami perché per `pubblico='docenti'` mostra il nome di chi ha
  -- scritto — qui no, per nessun pubblico, quindi un ramo solo. Una forma
  -- senza rami è anche una forma in cui non si può aggiungere un nome a metà.
  return query
    select d.creata_il, d.testo, d.stato, d.stato_da_tipo, d.stato_il
    from public.domande_live d
    where d.evento_id = p_evento_id
    order by d.creata_il;
end;
$$;

comment on function public.esporta_domande_evento(uuid) is
  'Le domande di una diretta per l''export, SENZA chi le ha scritte — per nessun pubblico, a differenza di domande_live_organizzatore che per i docenti mostra il nome. Non nomina `profiles` in nessun ramo: l''anonimato è strutturale e non si perde passando da un CSV.';

revoke all on function public.esporta_domande_evento(uuid) from public, anon;
grant execute on function public.esporta_domande_evento(uuid) to authenticated;

-- ============ le consegne, senza chi le ha scritte ============
-- ⚠️ SOLO ADMIN, e il controllo è un ramo affermativo: `current_ruolo()` NULL
-- non è uguale a 'admin', quindi cade nell'`else`. L'organizzatore NON entra —
-- è la decisione del 27/09, e il motivo per cui questa funzione non ha la
-- doppia guardia della sorella qui sopra.
create or replace function public.esporta_consegne_evento(p_evento_id uuid)
returns table (
  consegnata_il timestamptz,
  testo text,
  valutata boolean,
  valutata_il timestamptz,
  caratteri integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  return query
    select c.created_at, c.testo, c.valutata_il is not null, c.valutata_il, char_length(c.testo)::integer
    from public.consegne_evento c
    where c.evento_id = p_evento_id
    order by c.created_at;
end;
$$;

comment on function public.esporta_consegne_evento(uuid) is
  'Le risposte alla domanda finale di una diretta, SENZA chi le ha scritte. Admin-only: è la PRIMA strada per cui il testo di una consegna esce dalla sessione di chi l''ha scritta (consegne_evento ha solo select_own), e l''ente resta fuori di proposito — «quello che scrivono resta loro, tu vedi solo che è arrivato». `valutata` separa «il giudizio non è arrivato» da «non c''erano aree riconosciute», che valutata_il da sola non distingue.';

revoke all on function public.esporta_consegne_evento(uuid) from public, anon;
grant execute on function public.esporta_consegne_evento(uuid) to authenticated;
