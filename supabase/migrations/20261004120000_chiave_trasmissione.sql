-- LA CHIAVE DI TRASMISSIONE — il secondo pezzo di un flusso che ne aveva
-- solo il primo e il terzo.
--
-- Su `hosting_diretta='kireo'` il pannello dell'ente diceva, dal 26 luglio,
-- «riceverai la chiave di trasmissione da KIREO prima dell'evento» — e nel
-- prodotto non c'era NIENTE che gliela mandasse: nessun campo, nessuna
-- email, nessun posto in cui l'admin potesse scriverla. Il primo pezzo
-- (l'ente scegli «ospitata da KIREO») e il terzo (la pagina della diretta
-- che mostra il video) esistevano; il secondo era una frase.
--
-- ⚠️ PERCHÉ UNA TABELLA A PARTE E NON UNA COLONNA SU `eventi`
-- [verificato, non dedotto]: `eventi_select_approvati` è
-- `to anon, authenticated using (stato = 'approvato')`, e la RLS è per RIGA,
-- non per colonna — quindi QUALUNQUE colonna di `eventi` è leggibile da un
-- anonimo su qualunque evento approvato. Una `eventi.chiave_trasmissione`
-- sarebbe stata pubblica. E un `revoke select (colonna) ... from
-- authenticated` non salvava niente, perché `authenticated` è il ruolo
-- condiviso da ogni utente collegato: avrebbe accecato anche l'ente
-- proprietario (è la trappola già pagata in Fase 1 ente con il REVOKE UPDATE
-- su stato/piano_id).
--
-- LE TRE PROPRIETÀ CHIESTE, e la terza è quella che di solito si dimentica:
--
-- 1) LA CHIAVE È UN SEGRETO, non un titolo: chi la ha trasmette sul canale di
--    KIREO. Qui dentro vuol dire: visibile solo all'ente proprietario
--    dell'evento e all'admin (le due policy sotto, e nessuna altra);
--    nessuna policy di insert/update/delete per `authenticated`, quindi si
--    scrive solo dalla funzione; e la NOTIFICA PORTA IL FATTO, NON IL
--    SEGRETO — «la chiave è pronta» più un rimando al pannello, mai la
--    chiave in chiaro dentro una riga che poi finisce in un elenco. La
--    chiave non lascia mai la superficie autenticata.
--    Limite dichiarato: passa come parametro di una RPC, quindi viaggia nel
--    corpo di una richiesta HTTPS e comparirebbe in un log di statement del
--    database se qualcuno ne accendesse uno. Quello che possiamo garantire è
--    che nessun nostro codice la scriva in un log e che non esca per email.
--
-- 2) SI PUÒ CAMBIARE, perché una chiave si ruota. `on conflict do update` più
--    `aggiornata_il`: a schermo c'è sempre e solo la chiave corrente, quindi
--    non può restare quella vecchia. E la notifica scatta ANCHE sulla
--    rotazione, con il tipo che dice che è cambiata — è la metà «l'ente deve
--    saperlo» della proprietà, e senza di lei la rotazione sarebbe muta.
--
-- 3) FINCHÉ NON C'È, IL PANNELLO LO DICE. Non è in questa migrazione (è
--    lib/eventi/chiaveTrasmissione.ts), ma è la ragione per cui qui non c'è
--    nessun valore di default e nessuna riga pre-creata: l'assenza della riga
--    è il dato che fa dire «la chiave non è ancora stata preparata» invece di
--    «la riceverai», che è una promessa in cui l'ente non sa se è in ritardo
--    lui o noi.

create table public.chiavi_trasmissione (
  evento_id uuid primary key references public.eventi (id) on delete cascade,
  chiave text not null,
  aggiornata_il timestamptz not null default now(),
  aggiornata_da uuid references public.profiles (id)
);

comment on table public.chiavi_trasmissione is
  'Chiave di trasmissione (stream key) del canale KIREO per un evento con hosting_diretta=kireo. Una riga per evento: la rotazione è un update, aggiornata_il dice quando. SEGRETO: leggibile solo dall''ente organizzatore e dall''admin, scrivibile solo via imposta_chiave_trasmissione(). Nessuna riga = chiave non ancora preparata, ed è un dato che il pannello dell''ente mostra come tale.';

alter table public.chiavi_trasmissione enable row level security;

create policy chiavi_trasmissione_select_propria
  on public.chiavi_trasmissione for select
  to authenticated
  using (
    exists (
      select 1 from public.eventi e
      where e.id = chiavi_trasmissione.evento_id
        and e.organizzatore_id = public.current_istituzione_id()
    )
  );

create policy chiavi_trasmissione_select_admin
  on public.chiavi_trasmissione for select
  to authenticated
  using (public.current_ruolo() = 'admin');

-- Nessuna policy di insert/update/delete: ogni scrittura passa dalla
-- funzione qui sotto, che nella stessa transazione avvisa l'ente. Due gesti
-- separati (scrivi la chiave / avvisa) si dimenticano uno alla volta, e
-- quello che si dimenticherebbe è il secondo — cioè l'unica metà che fa
-- arrivare la chiave a qualcuno.
create or replace function public.imposta_chiave_trasmissione(p_evento_id uuid, p_chiave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hosting text;
  v_organizzatore uuid;
  v_esisteva boolean := false;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  if coalesce(btrim(p_chiave), '') = '' then
    raise exception 'chiave_vuota';
  end if;

  select e.hosting_diretta, e.organizzatore_id
    into v_hosting, v_organizzatore
  from public.eventi e
  where e.id = p_evento_id;

  if v_hosting is null then
    raise exception 'evento_non_trovato';
  end if;

  -- Una chiave del canale KIREO su un evento che l'ente trasmette dal
  -- proprio canale non vuol dire niente, e darla sarebbe darla a chi non
  -- deve trasmettere da noi.
  if v_hosting is distinct from 'kireo' then
    raise exception 'hosting_non_kireo';
  end if;

  select true into v_esisteva from public.chiavi_trasmissione where evento_id = p_evento_id;

  insert into public.chiavi_trasmissione (evento_id, chiave, aggiornata_il, aggiornata_da)
  values (p_evento_id, btrim(p_chiave), now(), auth.uid())
  on conflict (evento_id) do update
    set chiave = excluded.chiave,
        aggiornata_il = now(),
        aggiornata_da = excluded.aggiornata_da;

  -- LA NOTIFICA PORTA IL FATTO, NON IL SEGRETO: `riferimento_id` è l'evento,
  -- e il client la risolve in un link al pannello dell'ente. La chiave non
  -- entra qui dentro.
  --
  -- Nessun destinatario (un'istituzione senza utenti collegati) non è un
  -- errore: la chiave resta scritta e la vede l'admin. Un `raise` qui
  -- butterebbe via anche la scrittura.
  insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
  select ip.user_id,
         case
           when coalesce(v_esisteva, false) then 'chiave_trasmissione_cambiata'::public.notifica_tipo
           else 'chiave_trasmissione_pronta'::public.notifica_tipo
         end,
         p_evento_id
  from public.institution_profiles ip
  where ip.istituzione_id = v_organizzatore;
end;
$$;

comment on function public.imposta_chiave_trasmissione(uuid, text) is
  'Admin-only. Scrive (o ruota) la chiave di trasmissione di un evento hosting_diretta=kireo e avvisa l''ente nella stessa transazione, con due tipi distinti: pronta la prima volta, cambiata a ogni rotazione. La notifica non contiene la chiave.';

revoke all on function public.imposta_chiave_trasmissione(uuid, text) from public, anon;
grant execute on function public.imposta_chiave_trasmissione(uuid, text) to authenticated;
