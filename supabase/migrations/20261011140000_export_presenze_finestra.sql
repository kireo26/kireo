-- L'EXPORT PRESENZE STAMPAVA TRE NUMERI CHE NON POTEVANO ESSERE VERI INSIEME.
--
-- Trovato da Mario l'11/10/2026 sul primo CSV mai sceso (dopo `20261011130000`):
--
--     test 2:  finestra 17:15 → 17:20 (5 minuti)
--              minuti presenza 8,9     copertura 80%
--              primo_ping 17:08:31 — sette minuti prima dell'inizio
--
-- ─────────────────────────── la causa, letta nel codice e non dedotta
-- Le due righe di `presenze_live` sono del 4/10, cioè di PRIMA di
-- `20261004130000_presenza_dentro_la_diretta.sql`. Fino a lì `ping_presenza_live`
-- accettava un battito da `evento_in_finestra_diretta`, che si apre QUINDICI
-- MINUTI prima di `data_inizio` (`20260726110000`, riga del `- interval '15
-- minutes'`). Quindi quelle righe hanno `primo_ping` nel pre-roll e un
-- `ping_totali` che conta anche i battiti del pre-roll — indistinguibili da
-- quelli della diretta, perché `presenze_live` tiene un contatore solo.
--
-- ─────────────────────────── cosa cambia (le due cure del §0 a e b)
-- (a) `minuti_presenza` era `ultimo − primo`, senza nessun rapporto con la
--     finestra dichiarata. Ora è la SOVRAPPOSIZIONE di [primo_ping, ultimo_ping]
--     con [data_inizio, data_fine], mai sotto zero. La cura sulla scrittura
--     (4/10) protegge le righe nuove; questa protegge anche quelle che esistono
--     e si esportano oggi. Senza `data_fine` il numero non si può tagliare, e
--     non si stampa (prima si stampava grezzo). ⚠️ È un TETTO, non una misura:
--     due battiti agli estremi di un buco contano anche il buco, come prima.
-- (b) `copertura_percento` perde il `least(1.0, …)`. Qui si MISURA: «Il tetto
--     resti dove si mostra. Dove si misura, no» (Mario). Il tetto aveva fatto
--     stampare 100% — presenza perfetta — alla riga più impossibile della
--     tabella ([TEST] certificazione, 6 battiti su 5 attesi): ora stampa 120%,
--     che è il conteggio che non torna.
--
-- ⚠️⚠️ QUELLO CHE QUESTA MIGRAZIONE NON PUÒ CURARE, e va detto per non lasciar
-- credere il contrario: sulle righe del 4/10 la copertura RESTA non
-- attribuibile alla diretta. `ping_totali` non ha date: non si sa quanti dei
-- battiti stanno dentro la finestra. Su `test 2` il risultato sarà «minuti
-- 2,4, copertura 80%» — quattro battiti dichiarano quattro minuti in una
-- sovrapposizione di 2,4: due numeri ancora incompatibili, ma adesso non è più
-- il numero dei minuti a mentire, ed è la copertura a portare il difetto
-- visibile invece di arrotondarlo. Sulle righe nate dopo il 4/10 il problema non
-- esiste per costruzione (nessun battito fuori finestra).
--
-- ─────────────────────────── cosa NON cambia
-- I tetti DOVE SI DECIDE restano: la soglia di `chiudi_diretta_evento`
-- (`least(1, …) >= 0,75`, dove il tetto è irrilevante) e il `valore` della
-- prova di presenza (che deve stare in [0,1]). E `report_evento_aggregato`
-- (media della copertura per l'ente) non è toccato: è una decisione di Mario
-- se quello sia un posto dove si mostra o dove si misura.
--
-- `create or replace`, firma e tipo di ritorno invariati: cambiano i corpi e
-- due variabili. Corpi ripresi da `20261011130000`, che è la definizione viva
-- (applicata in produzione l'11/10) — e che per la regola sulle migrazioni
-- applicate NON si riscrive in place.

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
      case when v_ping_attesi is not null and pl.ping_totali is not null then round(pl.ping_totali::numeric / v_ping_attesi * 100, 1) else null end,
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
      case when v_ping_attesi is not null and pl.ping_totali is not null then round(pl.ping_totali::numeric / v_ping_attesi * 100, 1) else null end,
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
