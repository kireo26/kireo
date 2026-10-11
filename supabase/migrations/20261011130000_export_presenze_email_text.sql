-- L'EXPORT PRESENZE NON È MAI USCITO: UNA COLONNA DICHIARATA `text` SU UN
-- `character varying`.
--
-- Trovato in produzione da Mario l'11/10/2026, al primo giro a schermo mai
-- fatto su /diretta/[id] — e rotto dal 26 LUGLIO, cioè dal giorno in cui
-- `20260726120000_export_presenze.sql` è stato applicato:
--
--     GET /api/admin/presenze/1333a392-… → 500
--     Errore esporta_presenze_admin: structure of query does not match
--       function result type
--     DETAIL: Returned type character varying(255) does not match expected
--       type text in column 3.
--
-- La colonna 3 è `email ← auth.users.email`, che in Supabase è
-- `character varying(255)` mentre la funzione dichiara `text`. In PL/pgSQL il
-- confronto fra i tipi della query e quelli del `returns table (...)` è
-- STRETTO: non ammette nemmeno la conversione varchar → text. Nessun CSV di
-- presenze è mai uscito da nessuna delle due route.
--
-- ⚠️ LE ALTRE 12 COLONNE DI `esporta_presenze_admin` SONO GIUSTE, misurate e non
-- scelte: `profiles.nome`/`cognome`, `schools.denominazione`/
-- `codice_meccanografico`, `classi.nome_visualizzato` sono tutte `text`;
-- `presenze_live.primo_ping`/`ultimo_ping` sono `timestamptz` come dichiarato
-- (era il dubbio di Mario, e la risposta è che il cast sull'email basta);
-- `ie.stato` è un enum ma porta già il suo `::text`; `certificata_da_tipo` è
-- davvero `text`. Il modo di misurarlo è `scripts/verifica-tipi-tabella.sql`.
--
-- ─────────────────────────── le sorelle sono DUE, e si curano insieme
-- Le funzioni di `public` che leggono `auth.users` dentro un `RETURNS TABLE`
-- sono tre; due sono queste e hanno lo stesso difetto — `esporta_presenze_admin`
-- (premuta, rotta, vista) e `esporta_presenze_scuola` (MAI premuta da nessuno,
-- quindi rotta e invisibile). «Curane una sola e resta il mezzo fix che è
-- peggio di nessuno» (Mario).
--
-- ⚠️⚠️ LA TERZA NON È CURATA, E LA RAGIONE RIBALTA LA DIAGNOSI DI PARTENZA.
-- `email_studenti_scuola` (21/07) dichiara `email text`, seleziona `u.email`
-- SENZA CAST, e **funziona** — Mario ci ha esportato le email degli studenti il
-- 10/10 e ha letto il risultato. Sembrava che «il cast esistesse già in una
-- delle tre, scritto da qualcuno che lo sapeva, e non fosse viaggiato».
-- Misurato: NON ESISTE NESSUN CAST, da nessuna parte. Quella funzione è
-- `language sql`, dove la conversione di assegnazione varchar → text passa
-- senza che nessuno se ne accorga. Quindi non c'era una conoscenza che non ha
-- viaggiato: c'era la fortuna di una scelta di `language` che nessuno ha fatto
-- per questa ragione.
--
-- Non si tocca, e la dipendenza è SORVEGLIATA invece che nascosta: il giorno in
-- cui diventasse `language plpgsql` entrerebbe nell'enumerazione di
-- `scripts/verifica-tipi-tabella.sql` (che legge `pg_proc`, non un elenco
-- scritto a mano) e diventerebbe rossa lì, prima del deploy.
--
-- ─────────────────────────── cosa cambia, e cosa no
-- `create or replace` e non `drop`+`create`: la firma e il tipo di ritorno non
-- cambiano, cambia UN TOKEN nel corpo (`u.email` → `u.email::text`) in ognuna
-- delle due. I corpi sono ripresi VERBATIM da `20260726120000`, che è la
-- definizione viva (nessuna migrazione successiva le ha sostituite) — il corpo
-- di una funzione viva si copia e si confronta, non si ricorda. E `create or
-- replace` preserva i privilegi: i `grant` in coda sono per chi applica questo
-- file su un database che non ha ancora quello di luglio.
--
-- ⚠️ `20260726120000_export_presenze.sql` È APPLICATA IN PRODUZIONE dal 26
-- luglio, quindi non si riscrive in place: una migrazione applicata smette di
-- essere un file e diventa un fatto.

-- ============ export admin ============
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
      -- ⚠️ IL CAST È LA CORREZIONE DELL'11/10: `auth.users.email` è
      -- `character varying(255)`, e in PL/pgSQL un `return query` non lo
      -- converte da sé in `text`. Senza, questa funzione solleva sempre.
      u.email::text,
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
      -- Stesso cast, stessa ragione: vedi sopra.
      u.email::text,
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
