-- L'EXPORT PRESENZE: I MINUTI DIVENTANO QUELLI CONTATI, E LA RIGA SMETTE DI
-- CONTRADDIRE IL PROPRIO ESITO (Mario, 25/10/2026, sul CSV di chiusura).
--
--     test7   Minuti presenza 44     Copertura 71,1%   (32 battiti su 45)
--     test8   Minuti presenza 30,2   Copertura 28,9%   (13 battiti su 45)
--
-- `minuti_presenza` è la distanza fra il primo e l'ultimo battito tagliata alla
-- finestra: dentro quella distanza test8 ha diciassette minuti di buco. «La
-- colonna che ha il nome umano è quella che nessuno di noi userebbe.» Una scuola
-- legge «44 su 45» e nessuna certificazione, e non se lo spiega.
--
-- ─────────────────────────── cosa cambia
-- (a) una colonna nuova, `minuti_contati` = `ping_totali` (un battito al minuto):
--     è quella che il CSV chiama «Minuti presenza». `minuti_presenza` resta,
--     invariato, e il CSV lo chiama «Dal primo all'ultimo collegamento».
-- (b) la copertura di chi non si è mai collegato è 0, non null.
-- (c) l'ordine è deterministico: due omonimi (oggi letteralmente due «Mario
--     Izzo») uscivano in un ordine qualunque. Criterio finale l'email, poi l'id.
--
-- ⚠️ VERIFICATO PRIMA DI CAMBIARE: `minuti_presenza` non entra in nessun
-- calcolo — è letto solo dalle due route dell'export e da
-- `lib/eventi/exportPresenze.ts`. Soglia, ore PCTO e report aggregato usano
-- `ping_totali` e `ping_attesi_evento`. Nessun esito si sposta.
--
-- Il tipo di ritorno cambia (una colonna in più), quindi `drop` + `create`, e i
-- permessi si rimettono in coda: `revoke` prima di `grant`, perché una funzione
-- nuova nasce eseguibile da `anon` per i default privileges di Supabase.
-- Corpi ripresi da `20261011140000`, che è la definizione viva — e che per la
-- regola sulle migrazioni applicate NON si riscrive in place.

-- ============ export admin ============
drop function if exists public.esporta_presenze_admin(uuid);
create function public.esporta_presenze_admin(p_evento_id uuid)
returns table (
  nome text,
  cognome text,
  email text,
  scuola_denominazione text,
  scuola_codice text,
  classe_nome text,
  primo_ping timestamptz,
  ultimo_ping timestamptz,
  minuti_presenza numeric,
  minuti_contati integer,
  copertura_percento numeric,
  stato_finale text,
  certificata_da_tipo text,
  certificata_da_nome text,
  attestato_emesso boolean,
  attestato_codice uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ping_attesi numeric;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  select e.data_inizio, e.data_fine into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      p.nome,
      p.cognome,
      -- Il cast è la correzione di `20261011130000`, invariata: `auth.users.email` è
      -- `character varying(255)`, e in PL/pgSQL un `return query` non lo
      -- converte da sé in `text`. Senza, questa funzione solleva sempre.
      u.email::text,
      s.denominazione,
      s.codice_meccanografico,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      -- ⚠️ IL TAGLIO ALLA FINESTRA, IN LETTURA (11/10, vedi la testa del file):
      -- la sovrapposizione di [primo_ping, ultimo_ping] con [data_inizio,
      -- data_fine], mai sotto zero. Senza una finestra dichiarata il numero
      -- non si può tagliare, quindi non si stampa.
      case when pl.primo_ping is not null and v_inizio is not null and v_fine is not null
        then round(greatest(0, extract(epoch from (least(pl.ultimo_ping, v_fine) - greatest(pl.primo_ping, v_inizio)))) / 60, 1)
        else null end,
      -- ⚠️ NESSUN TETTO: qui si MISURA. Un rapporto sopra 100 è un conteggio che
      -- non torna, e va fatto vedere invece di arrotondarlo.
      -- ⚠️ I MINUTI CONTATI (25/10): un battito al minuto, cioè il tempo davvero
      -- contato. Chi non si è mai collegato ne ha zero, ed è un fatto.
      coalesce(pl.ping_totali, 0),
      -- ⚠️ NESSUN TETTO: qui si MISURA. E chi non si è mai collegato ha 0%, non
      -- una cella vuota (25/10): zero battiti su N attesi è un fatto.
      case when v_ping_attesi is not null then round(coalesce(pl.ping_totali, 0)::numeric / v_ping_attesi * 100, 1) else null end,
      ie.stato::text,
      ie.certificata_da_tipo,
      (select (cp.nome || ' ' || cp.cognome) from public.profiles cp where cp.id = ie.certificata_da_user),
      (att.id is not null),
      att.codice_verifica
    from public.iscrizioni_eventi ie
    join public.profiles p on p.id = ie.student_id
    left join auth.users u on u.id = ie.student_id
    left join public.presenze_live pl on pl.evento_id = ie.evento_id and pl.user_id = ie.student_id
    left join public.student_profiles sp on sp.user_id = ie.student_id
    left join public.schools s on s.codice_meccanografico = sp.school_code
    left join public.attestati att on att.evento_id = ie.evento_id and att.user_id = ie.student_id
    where ie.evento_id = p_evento_id
    order by p.cognome, p.nome, u.email nulls last, ie.student_id;
end;
$$;

revoke all on function public.esporta_presenze_admin(uuid) from public, anon;
grant execute on function public.esporta_presenze_admin(uuid) to authenticated;

-- ============ export scuola ============
drop function if exists public.esporta_presenze_scuola(uuid);
create function public.esporta_presenze_scuola(p_evento_id uuid)
returns table (
  nome text,
  cognome text,
  email text,
  classe_nome text,
  primo_ping timestamptz,
  ultimo_ping timestamptz,
  minuti_presenza numeric,
  minuti_contati integer,
  copertura_percento numeric,
  stato_finale text,
  certificata_da_tipo text,
  certificata_da_nome text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scuola_id text := public.current_scuola_id();
  v_ping_attesi numeric;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;
  if v_scuola_id is null then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  select e.data_inizio, e.data_fine into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      p.nome,
      p.cognome,
      -- Stesso cast, stessa ragione: vedi sopra.
      u.email::text,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      -- ⚠️ IL TAGLIO ALLA FINESTRA, IN LETTURA (11/10, vedi la testa del file):
      -- la sovrapposizione di [primo_ping, ultimo_ping] con [data_inizio,
      -- data_fine], mai sotto zero. Senza una finestra dichiarata il numero
      -- non si può tagliare, quindi non si stampa.
      case when pl.primo_ping is not null and v_inizio is not null and v_fine is not null
        then round(greatest(0, extract(epoch from (least(pl.ultimo_ping, v_fine) - greatest(pl.primo_ping, v_inizio)))) / 60, 1)
        else null end,
      -- ⚠️ NESSUN TETTO: qui si MISURA. Un rapporto sopra 100 è un conteggio che
      -- non torna, e va fatto vedere invece di arrotondarlo.
      -- ⚠️ I MINUTI CONTATI (25/10): un battito al minuto, cioè il tempo davvero
      -- contato. Chi non si è mai collegato ne ha zero, ed è un fatto.
      coalesce(pl.ping_totali, 0),
      -- ⚠️ NESSUN TETTO: qui si MISURA. E chi non si è mai collegato ha 0%, non
      -- una cella vuota (25/10): zero battiti su N attesi è un fatto.
      case when v_ping_attesi is not null then round(coalesce(pl.ping_totali, 0)::numeric / v_ping_attesi * 100, 1) else null end,
      ie.stato::text,
      ie.certificata_da_tipo,
      (select (cp.nome || ' ' || cp.cognome) from public.profiles cp where cp.id = ie.certificata_da_user)
    from public.iscrizioni_eventi ie
    join public.student_profiles sp on sp.user_id = ie.student_id
    join public.profiles p on p.id = ie.student_id
    left join auth.users u on u.id = ie.student_id
    left join public.presenze_live pl on pl.evento_id = ie.evento_id and pl.user_id = ie.student_id
    where ie.evento_id = p_evento_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = v_scuola_id
    order by p.cognome, p.nome, u.email nulls last, ie.student_id;
end;
$$;

revoke all on function public.esporta_presenze_scuola(uuid) from public, anon;
grant execute on function public.esporta_presenze_scuola(uuid) to authenticated;
