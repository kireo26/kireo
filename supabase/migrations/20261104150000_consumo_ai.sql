-- IL CONTO DI QUELLO CHE PAGHIAMO (Mario, 27/10). Non un riassunto dei tetti:
-- *un tetto per persona limita una persona, e le persone si creano gratis da
-- una pagina pubblica; sommati, mille tetti rispettati fanno una spesa senza
-- tetto.* Questa tabella è l'unica cosa che misura la quantità che paghiamo:
-- somma per giorno e per processo, mai per persona — non ha un riferimento a
-- nessuno studente, apposta.
--
-- LA PRIMA VOLTA NON BLOCCA NIENTE: rende visibile la spesa. Bloccare viene
-- dopo averla guardata. E serve anche a un'altra cosa, che è la ragione per
-- cui viene subito dopo i tetti: senza un conto totale, un tetto che smette di
-- funzionare è invisibile — si scopre guardando il numero che il meccanismo
-- dovrebbe produrre, non il meccanismo (la forma del «Download guida: 0»).
--
-- Si scrive dopo OGNI risposta del modello, compresi i secondi tentativi della
-- guardia sulla lingua e del JSON: si pagano uguali. Una chiamata fallita
-- prima della risposta non lascia una riga (non c'è un consumo da leggere).
-- Il giorno è in ora italiana, come i tetti del 27/10.
--
-- La scrive solo la service-role (lib/ai/consumo.ts), come il contatore della
-- guardia sulla lingua: un contatore che lo studente può alzare o abbassare
-- non misura niente.
--
-- COME SI VERIFICA APPLICATA:
--   select to_regclass('public.consumo_ai_giorno') is not null              → true
--   select has_function_privilege('authenticated',
--     'public.registra_consumo_ai(text, text, boolean, integer, integer, integer, integer)', 'execute') → false
-- E il conto vero si legge con `npm run banco spesa`.

create table public.consumo_ai_giorno (
  giorno date not null,
  processo text not null,
  modello text not null,
  di_prova boolean not null,
  chiamate integer not null default 0 check (chiamate >= 0),
  token_input bigint not null default 0 check (token_input >= 0),
  token_output bigint not null default 0 check (token_output >= 0),
  token_cache_scrittura bigint not null default 0 check (token_cache_scrittura >= 0),
  token_cache_lettura bigint not null default 0 check (token_cache_lettura >= 0),
  primary key (giorno, processo, modello, di_prova)
);
alter table public.consumo_ai_giorno enable row level security;
revoke all on public.consumo_ai_giorno from anon, authenticated;

comment on table public.consumo_ai_giorno is
  '20261104150000: il consumo del modello a pagamento, per giorno (ora italiana), processo, modello e profili di prova. Nessun riferimento a persone. La scrive solo registra_consumo_ai, dalla service-role.';

create or replace function public.registra_consumo_ai(
  p_processo text,
  p_modello text,
  p_di_prova boolean,
  p_input integer,
  p_output integer,
  p_cache_scrittura integer,
  p_cache_lettura integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_righe integer;
begin
  if coalesce(p_processo, '') = '' or coalesce(p_modello, '') = '' then
    raise exception 'consumo_senza_processo';
  end if;
  if least(coalesce(p_input, 0), coalesce(p_output, 0), coalesce(p_cache_scrittura, 0), coalesce(p_cache_lettura, 0)) < 0 then
    raise exception 'consumo_negativo';
  end if;

  insert into public.consumo_ai_giorno as c
    (giorno, processo, modello, di_prova, chiamate, token_input, token_output, token_cache_scrittura, token_cache_lettura)
  values (
    (now() at time zone 'Europe/Rome')::date, p_processo, p_modello, coalesce(p_di_prova, false), 1,
    coalesce(p_input, 0), coalesce(p_output, 0), coalesce(p_cache_scrittura, 0), coalesce(p_cache_lettura, 0)
  )
  on conflict (giorno, processo, modello, di_prova) do update set
    chiamate = c.chiamate + 1,
    token_input = c.token_input + excluded.token_input,
    token_output = c.token_output + excluded.token_output,
    token_cache_scrittura = c.token_cache_scrittura + excluded.token_cache_scrittura,
    token_cache_lettura = c.token_cache_lettura + excluded.token_cache_lettura;
  get diagnostics v_righe = row_count;
  if v_righe <> 1 then
    raise exception 'consumo non scritto: % righe', v_righe;
  end if;
end;
$$;

revoke all on function public.registra_consumo_ai(text, text, boolean, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.registra_consumo_ai(text, text, boolean, integer, integer, integer, integer) to service_role;

do $$
begin
  if has_function_privilege('authenticated', 'public.registra_consumo_ai(text, text, boolean, integer, integer, integer, integer)', 'execute') then
    raise exception 'registra_consumo_ai è eseguibile da authenticated';
  end if;
end $$;
