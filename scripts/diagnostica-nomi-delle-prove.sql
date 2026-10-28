-- LA SONDA DEL QUATTORDICESIMO MODO (28/10): il ruolo nominato nel titolo di una
-- prova contro l'identità che il database ha visto agire. SOLO SULLA REPLICA,
-- mai in produzione: riscrive auth.uid().
--
-- Come funziona: auth.uid() annota in un parametro di sessione chi l'ha chiamata
-- (il ruolo di database e il ruolo di profilo della sub); un trigger su ogni
-- tabella `esiti` che uno script crea stampa, a ogni riga, quelle annotazioni
-- più l'identità attiva in quell'istante, e le azzera. La legge
-- `scripts/diagnostica-nomi-delle-prove.js`; la lancia
-- `scripts/diagnostica-nomi-delle-prove.sh`.
--
-- ⚠️ È CIECA DOVE NON SI CHIAMA auth.uid(): un rifiuto per privilegio arriva
-- prima di qualunque policy, quindi non annota niente. Lì vale l'identità
-- attiva quando si scrive l'esito, e se lo script l'ha già azzerata la prova
-- risulta «senza sessione vista»: va letta, non è un disaccordo.
-- ⚠️ ATTRIBUISCE MALE gli script che eseguono tutte le azioni e scrivono gli
-- esiti dopo (`verifica-istituzioni-colonne`): le annotazioni finiscono tutte
-- sul primo esito. Anche questi si leggono.

create or replace function public.sonda_ruolo(p uuid) returns text
language sql stable security definer as $$
  select case when p is null then null
              else coalesce((select ruolo::text from public.profiles where id = p), '?') end
$$;
grant execute on function public.sonda_ruolo(uuid) to public;

-- plpgsql e non sql: una funzione sql si incorporerebbe nella policy, e
-- l'annotazione non avverrebbe.
create or replace function auth.uid() returns uuid language plpgsql stable as $$
declare v text := nullif(current_setting('request.jwt.claim.sub', true), '');
begin
  perform set_config('sonda.visti',
    coalesce(current_setting('sonda.visti', true), '') || ' ' || current_user || ':'
      || coalesce(public.sonda_ruolo(v::uuid), '-'), false);
  return v::uuid;
end $$;
grant execute on function auth.uid() to public;

create or replace function public.sonda_esiti() returns trigger language plpgsql as $$
declare v text := nullif(current_setting('request.jwt.claim.sub', true), '');
begin
  raise notice 'SONDA|%|%|%|%', new.n,
    replace(coalesce(row_to_json(new)->>'cosa', row_to_json(new)->>'proprieta', ''), '|', '/'),
    coalesce(current_setting('sonda.visti', true), ''),
    current_user || ':' || coalesce(public.sonda_ruolo(v::uuid), '-');
  perform set_config('sonda.visti', '', false);
  return new;
end $$;
grant execute on function public.sonda_esiti() to public;

create or replace function public.sonda_aggancia() returns event_trigger language plpgsql as $$
declare r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() where command_tag = 'CREATE TABLE' loop
    if r.object_identity like '%.esiti' then
      execute format('create trigger sonda before insert on %s for each row execute function public.sonda_esiti()', r.object_identity);
      perform set_config('sonda.visti', '', false);
    end if;
  end loop;
end $$;
drop event trigger if exists sonda_esiti;
create event trigger sonda_esiti on ddl_command_end when tag in ('CREATE TABLE')
  execute function public.sonda_aggancia();
