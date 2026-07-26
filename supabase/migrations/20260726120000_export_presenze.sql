-- Infrastruttura webinar in diretta (3/3): export presenze per admin e
-- scuola (dati individuali, contesti dove è già legittimo vederli — stesso
-- principio di email_studenti_scuola/scheda studente) e report aggregato
-- per l'organizzatore (MAI dati individuali, soglia di soppressione k=5
-- per evitare la ri-identificazione dai gruppi piccoli).

-- ============ export admin ============
-- Solo admin. Un'unica forma di riga copre sia eventi studenti (scuola,
-- classe valorizzate, attestato sempre null) sia eventi docenti (scuola,
-- classe sempre null, attestato valorizzato quando emesso): la route che
-- genera il CSV sceglie quali colonne stampare in base a eventi.pubblico.
create or replace function public.esporta_presenze_admin(p_evento_id uuid)
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
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

  return query
    select
      p.nome,
      p.cognome,
      u.email,
      s.denominazione,
      s.codice_meccanografico,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      case when pl.primo_ping is not null then round(extract(epoch from (pl.ultimo_ping - pl.primo_ping)) / 60, 1) else null end,
      case when v_ping_attesi is not null and pl.ping_totali is not null then round(least(1.0, pl.ping_totali::numeric / v_ping_attesi) * 100, 1) else null end,
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
    order by p.cognome, p.nome;
end;
$$;

grant execute on function public.esporta_presenze_admin(uuid) to authenticated;

-- ============ export scuola ============
-- Solo referente/tutor con permesso certificazione_presenze (stesso
-- permesso già usato da certifica_presenza), SOLO per studenti verificati
-- della propria scuola iscritti all'evento (qualunque origine: anche
-- un'iscrizione self-service resta uno studente della scuola, a differenza
-- di getRegistroPresenze che filtra solo origine=scuola per il flusso di
-- certificazione — qui serve la vista completa per i registri FSL).
create or replace function public.esporta_presenze_scuola(p_evento_id uuid)
returns table (
  nome text,
  cognome text,
  email text,
  classe_nome text,
  primo_ping timestamptz,
  ultimo_ping timestamptz,
  minuti_presenza numeric,
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
begin
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;
  if v_scuola_id is null then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

  return query
    select
      p.nome,
      p.cognome,
      u.email,
      (select cl.nome_visualizzato from public.classi_studenti cst join public.classi cl on cl.id = cst.classe_id where cst.student_id = ie.student_id limit 1),
      pl.primo_ping,
      pl.ultimo_ping,
      case when pl.primo_ping is not null then round(extract(epoch from (pl.ultimo_ping - pl.primo_ping)) / 60, 1) else null end,
      case when v_ping_attesi is not null and pl.ping_totali is not null then round(least(1.0, pl.ping_totali::numeric / v_ping_attesi) * 100, 1) else null end,
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
    order by p.cognome, p.nome;
end;
$$;

grant execute on function public.esporta_presenze_scuola(uuid) to authenticated;

-- ============ report aggregato per l'organizzatore (MAI dati individuali)
-- ============
create or replace function public.report_evento_aggregato(p_evento_id uuid)
returns table (totale_iscritti integer, totale_presenti integer, copertura_media numeric, numero_domande integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
  v_ping_attesi numeric;
begin
  select organizzatore_id into v_organizzatore_id from public.eventi where id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);

  return query
    select
      (select count(*)::integer from public.iscrizioni_eventi where evento_id = p_evento_id),
      (select count(*)::integer from public.presenze_live where evento_id = p_evento_id),
      (
        select round(avg(least(1.0, pl.ping_totali::numeric / v_ping_attesi)) * 100, 1)
        from public.presenze_live pl
        where pl.evento_id = p_evento_id and v_ping_attesi is not null
      ),
      (select count(*)::integer from public.domande_live where evento_id = p_evento_id);
end;
$$;

grant execute on function public.report_evento_aggregato(uuid) to authenticated;

-- Distribuzione geografica dei presenti (solo eventi pubblico=studenti: un
-- evento docenti non ha righe student_profiles da unire, la query
-- restituisce semplicemente zero righe). Soglia di soppressione k=5: un
-- gruppo provincia+tipo_istituto con meno di 5 presenti non viene
-- restituito affatto (HAVING nella query stessa, non un filtro
-- applicativo a valle) — nessun nome, nessun id, mai nel risultato.
create or replace function public.report_evento_distribuzione(p_evento_id uuid)
returns table (provincia text, tipo_istituto text, conteggio integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizzatore_id uuid;
begin
  select organizzatore_id into v_organizzatore_id from public.eventi where id = p_evento_id;

  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore_id is not null and v_organizzatore_id = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  return query
    select s.provincia, s.tipo_istituto::text, count(*)::integer
    from public.presenze_live pl
    join public.student_profiles sp on sp.user_id = pl.user_id
    join public.schools s on s.codice_meccanografico = sp.school_code
    where pl.evento_id = p_evento_id
    group by s.provincia, s.tipo_istituto
    having count(*) >= 5
    order by count(*) desc;
end;
$$;

grant execute on function public.report_evento_distribuzione(uuid) to authenticated;
