-- L'INDIRIZZO DEL SERVER accanto alla chiave di trasmissione.
--
-- IL DIFETTO (verificato nel codice il 25/10): `chiavi_trasmissione` aveva
-- solo `chiave`. Una chiave senza l'indirizzo del server a cui mandarla
-- (`rtmp://…`) non trasmette niente: con quello che il pannello dava a un
-- ente, quell'ente non poteva andare in onda sul canale di KIREO. La via
-- `hosting_diretta = 'kireo'` non è mai stata provata, e questo è il primo
-- motivo per cui non avrebbe funzionato.
--
-- COSA CAMBIA:
--   · una colonna `server`, con un CHECK sullo schema (rtmp:// o rtmps://);
--   · `imposta_chiave_trasmissione` prende ANCHE il server, e lo pretende:
--     una chiave salvata senza server è esattamente il difetto di partenza.
--
-- ⚠️ DROP + CREATE, NON `create or replace`: aggiungere un parametro con
-- `create or replace` crea un SECONDO overload invece di sostituire il primo
-- (già successo con finalize_registration il 12/07). La firma vecchia sparisce
-- e i permessi si rimettono qui sotto — revoke prima del grant, perché una
-- funzione nuova nasce eseguibile da `anon` per i default privileges.
--
-- Il corpo è quello di 20261004120000, con il server in più e nient'altro.
--
-- Le righe esistenti restano con `server` nullo: il pannello dell'ente lo dice
-- invece di dare per buona una chiave che da sola non serve.
--
-- ⚠️ VA APPLICATA PRIMA DEL DEPLOY: il form dell'admin chiama la firma a tre
-- argomenti, e senza questa migrazione la chiamata fallisce.

alter table public.chiavi_trasmissione add column if not exists server text;

alter table public.chiavi_trasmissione drop constraint if exists chiavi_trasmissione_server_schema;
alter table public.chiavi_trasmissione add constraint chiavi_trasmissione_server_schema
  check (server is null or server ~ '^rtmps?://[^\s]+$');

comment on column public.chiavi_trasmissione.server is
  'Indirizzo del server di ingest (rtmp:// o rtmps://) a cui va mandata la chiave. Senza, la chiave da sola non trasmette.';

drop function if exists public.imposta_chiave_trasmissione(uuid, text);

create function public.imposta_chiave_trasmissione(p_evento_id uuid, p_chiave text, p_server text)
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

  if coalesce(btrim(p_server), '') = '' then
    raise exception 'server_vuoto';
  end if;

  if btrim(p_server) !~ '^rtmps?://[^\s]+$' then
    raise exception 'server_non_valido';
  end if;

  select e.hosting_diretta, e.organizzatore_id
    into v_hosting, v_organizzatore
  from public.eventi e
  where e.id = p_evento_id;

  if v_hosting is null then
    raise exception 'evento_non_trovato';
  end if;

  if v_hosting is distinct from 'kireo' then
    raise exception 'hosting_non_kireo';
  end if;

  select true into v_esisteva from public.chiavi_trasmissione where evento_id = p_evento_id;

  insert into public.chiavi_trasmissione (evento_id, chiave, server, aggiornata_il, aggiornata_da)
  values (p_evento_id, btrim(p_chiave), btrim(p_server), now(), auth.uid())
  on conflict (evento_id) do update
    set chiave = excluded.chiave,
        server = excluded.server,
        aggiornata_il = now(),
        aggiornata_da = excluded.aggiornata_da;

  -- La notifica porta il fatto, non il segreto (vedi 20261004120000).
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

comment on function public.imposta_chiave_trasmissione(uuid, text, text) is
  'Admin-only. Scrive (o ruota) chiave e server di trasmissione di un evento hosting_diretta=kireo e avvisa l''ente nella stessa transazione: pronta la prima volta, cambiata a ogni rotazione. Pretende il server: una chiave senza server non trasmette. La notifica non contiene la chiave.';

revoke all on function public.imposta_chiave_trasmissione(uuid, text, text) from public, anon;
grant execute on function public.imposta_chiave_trasmissione(uuid, text, text) to authenticated;
