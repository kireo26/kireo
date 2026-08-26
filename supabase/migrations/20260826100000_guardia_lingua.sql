-- KIREO — due contatori per la guardia della lingua invariante.
--
-- CONTESTO. Il testo che uno studente legge è per metà scritto a mano (cablato
-- nel finale, sorvegliato dal tripwire `npm run test:finale`) e per metà
-- generato da un revisore AI, dove un test statico non arriva. Lì valgono due
-- cose diverse e complementari: una REGOLA nel prompt, che abbassa la frequenza
-- con cui esce una forma accordata al maschile, e una GUARDIA nel codice, che
-- rilegge la risposta e ne richiede una sola volta un'altra. La regola orienta,
-- la guardia riduce l'esposizione: nessuna delle due chiude il caso da sola.
--
-- PERCHÉ CONTARE. Il tasso che conosciamo oggi (2 forme reali su 24 chiamate,
-- ~8%) viene da una misura su UNA consegna-fixture. I testi veri degli studenti
-- sono un'altra distribuzione e non sapremo quale finché non ne passeranno
-- abbastanza. Con questi due numeri, fra un mese il tasso non lo stimiamo: ce lo
-- dice la produzione. E se scattasse all'1% invece che all'8%, sapremmo che la
-- regola funziona e che il campione era troppo piccolo per farcelo vedere.
--
-- Due contatori, nient'altro: nessuna dashboard, nessun dato per studente,
-- nessun testo salvato. Finiscono nella riga dell'alert giornaliero che esiste
-- già (il cron del motore workshop), come i tre esiti del revisore.

-- ── la tabella: una riga al giorno ─────────────────────────────────────────
create table if not exists public.guardia_lingua_giorno (
  giorno date primary key default (now() at time zone 'utc')::date,
  -- quante volte la guardia è INTERVENUTA: la prima risposta conteneva una
  -- forma accordata e ne è stata richiesta un'altra.
  interventi integer not null default 0,
  -- quante di quelle volte lo studente ha comunque visto una forma accordata:
  -- il secondo tentativo è tornato ancora accordato, oppure è fallito e si è
  -- spedita la prima risposta. È il numero che conta davvero — l'esposizione
  -- residua, non il lavoro fatto dalla guardia.
  ancora_accordato integer not null default 0
);

comment on table public.guardia_lingua_giorno is
  'Due contatori giornalieri della guardia sulla lingua invariante: quante volte è intervenuta e quante volte lo studente ha comunque letto una forma accordata. Nessun dato individuale, nessun testo.';

alter table public.guardia_lingua_giorno enable row level security;

-- Nessuna policy di scrittura: si scrive SOLO dalla funzione qui sotto (stesso
-- principio di ogni altra scrittura function-only del progetto). In lettura,
-- solo admin: il cron gira con la service-role, che la RLS non la vede.
drop policy if exists guardia_lingua_select_admin on public.guardia_lingua_giorno;
create policy guardia_lingua_select_admin on public.guardia_lingua_giorno
  for select to authenticated
  using (public.current_ruolo() = 'admin');

-- ── la funzione: un colpo, idempotente sul giorno ──────────────────────────
-- SECURITY DEFINER perché la chiamano due contesti diversi: le route che girano
-- nella sessione dello studente (finale Escape, consegne workshop) e il cron,
-- che gira con la service-role. Nessun parametro identificante: la funzione non
-- sa e non deve sapere CHI ha generato l'intervento.
create or replace function public.registra_guardia_lingua(p_ancora_accordato boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guardia_lingua_giorno as g (giorno, interventi, ancora_accordato)
  values ((now() at time zone 'utc')::date, 1, case when coalesce(p_ancora_accordato, false) then 1 else 0 end)
  on conflict (giorno) do update
    set interventi = g.interventi + 1,
        ancora_accordato = g.ancora_accordato + case when coalesce(p_ancora_accordato, false) then 1 else 0 end;
end;
$$;

comment on function public.registra_guardia_lingua(boolean) is
  'Incrementa i contatori del giorno corrente (UTC). Chiamata dalla guardia in lib/ai/chiamaJson.ts, sempre best-effort: se fallisce, il feedback dello studente parte lo stesso.';

revoke all on function public.registra_guardia_lingua(boolean) from public;
grant execute on function public.registra_guardia_lingua(boolean) to authenticated, service_role;
