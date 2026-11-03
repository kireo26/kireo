-- Conservare tutto, togliere il nome (Mario, 03/11).
--
-- Fino a oggi cancellare uno studente distruggeva, in cascata, ogni sua riga, e
-- le statistiche passate cambiavano da sole. La decisione di Mario: *voglio
-- conservare tutto quello che accade in piattaforma.* Le regole, sue:
--
--   (a) I FATTI RESTANO: tentativi, punteggi, segnali, presenze, iscrizioni a
--       eventi già cominciati, scaricamenti, salvataggi, le aree dichiarate.
--   (b) IL TESTO ESCE: quello che ha scritto lui (risposte aperte delle
--       missioni, diario, portfolio, domanda finale, domande in diretta,
--       elaborato e chat dei workshop, i suoi messaggi a un ente o a un altro
--       studente), E quello che abbiamo scritto noi su di lui (le motivazioni,
--       le revisioni, le reazioni del cliente). I NUMERI dentro quei giudizi
--       restano. La metà di un terzo resta: si svuota solo la sua.
--   (c) I RAPPORTI IN CORSO SI CHIUDONO: seguire, la newsletter, il profilo
--       condiviso, la classe, le notifiche, i codici, le email in coda, le
--       iscrizioni a eventi non ancora cominciati, il workshop in corso. Dove un
--       rapporto è anche un fatto che le statistiche contano (seguire, il
--       profilo condiviso) si chiude MARCANDO UNA DATA, non cancellando la riga:
--       «Studenti raggiunti dall'inizio» non deve scendere.
--   (d) LE ORE CERTIFICATE RESTANO COL NOME: nome e cognome si COPIANO sulla
--       riga della presenza certificata (`iscrizioni_eventi`) e sull'attestato
--       di un docente, al momento della cancellazione. Non si allarga la lapide.
--   (e) IL NOME ESCE: chi non ha firmato niente diventa un'identità anonima
--       («Studente #4471», «Docente #12»), e il suo indirizzo torna libero.
--       Chi ha firmato resta la lapide di 20261203100000, con nome, cognome e
--       indirizzo (che resta bloccato): non è anonima, ed è giusto, perché le
--       sue firme dicono chi è stato. Il trattamento dei fatti e dei testi è lo
--       stesso nei due casi.
--   (f) IL LETTORE DI UN NOME: un registro di fatti mostra l'etichetta (o il
--       nome copiato, sulle ore); una persona con cui si può fare qualcosa (un
--       elenco di studenti da verificare, iscrivere, a cui scrivere) NON compare.
--
-- CHI È FUORI, E PERCHÉ: lo staff della scuola senza firme si cancella per
-- intero come prima (non ha fatti da conservare: la sua riga nello staff era
-- tutto). L'ente e l'admin non si cancellano da qui (`ruolo_non_previsto`).
-- Un utente tolto dal cruscotto di Supabase o dal SQL Editor si porta via il
-- profilo come prima (`cancella_profilo_con_l_utente`): questo capitolo vale
-- per la cancellazione chiesta dalla persona.
--
-- LE CASCATE RESTANO DOV'ERANO: non scattano più, perché il profilo non si
-- cancella. Cambiarle avrebbe tolto alle guardie dell'export e delle firme la
-- dichiarazione di appartenenza su cui poggiano. Il trattamento tabella per
-- tabella sta in `supabase/conservare-alla-cancellazione.json`, e
-- `npm run test:conservare` è rosso su una tabella in cascata che non dice cosa
-- le succede.
--
-- E IL TETTO SULLA ROUTE DELLA REGISTRAZIONE (Mario): `/api/registrazione/indirizzo`
-- diceva a chiunque, senza limite, se un indirizzo era di una lapide. Ora conta
-- come i codici d'invito dei tutor: 10 domande in un'ora per rete, nella stessa
-- tabella (`tentativi_codice_invito`, chiave 'registrazione:<sha256>').
--
-- L'ORDINE: 20261204100000 (la parola) prima; questa PRIMA del deploy. Con
-- questa applicata il codice di prima funziona: la firma di `delete_own_account`
-- è la stessa, e risponde un esito nuovo («anonimizzato») che la pagina di
-- prima non conosce e tratta come una cancellazione intera; la route vecchia
-- chiama ancora `indirizzo_di_un_account_cancellato`, che resta.

-- 1. Le colonne.
create sequence if not exists public.profili_anonimi_seq;
alter table public.profiles add column if not exists numero_anonimo integer unique;
comment on column public.profiles.numero_anonimo is
  '20261204110000: il numero dell''etichetta anonima («Studente #N») di chi ha cancellato l''account senza aver firmato niente. NULL per tutti gli altri.';

alter table public.seguiti add column if not exists chiuso_il timestamptz;
comment on column public.seguiti.chiuso_il is
  '20261204110000: il rapporto chiuso dalla cancellazione dell''account. La riga resta perché «raggiunti dall''inizio» la conta.';

alter table public.iscrizioni_eventi add column if not exists nome_alla_cancellazione text;
alter table public.iscrizioni_eventi add column if not exists cognome_alla_cancellazione text;
comment on column public.iscrizioni_eventi.nome_alla_cancellazione is
  '20261204110000: copiato alla cancellazione dell''account. Il nome vero se la presenza è certificata (le ore restano col nome), l''etichetta anonima altrimenti.';
alter table public.attestati add column if not exists nome_alla_cancellazione text;
alter table public.attestati add column if not exists cognome_alla_cancellazione text;
comment on column public.attestati.nome_alla_cancellazione is
  '20261204110000: il nome vero, copiato alla cancellazione dell''account: un attestato dice di chi è.';

-- I testi che escono: la colonna diventa NULL, e una data dice quando. Il
-- client non scrive `testo_rimosso_il` (nessuna concessione), quindi non può
-- inserire un testo NULL: il vincolo lo pretende insieme alla data.
alter table public.journal_entry alter column testo drop not null;
alter table public.journal_entry add column if not exists testo_rimosso_il timestamptz;
alter table public.journal_entry add constraint journal_entry_testo_o_rimosso check ((testo is null) = (testo_rimosso_il is not null));

alter table public.portfolio_item alter column titolo drop not null;
alter table public.portfolio_item add column if not exists testo_rimosso_il timestamptz;
alter table public.portfolio_item add constraint portfolio_item_titolo_o_rimosso check ((titolo is null) = (testo_rimosso_il is not null));

alter table public.consegne_evento alter column testo drop not null;
alter table public.consegne_evento add column if not exists testo_rimosso_il timestamptz;
alter table public.consegne_evento drop constraint if exists consegne_evento_testo_check;
alter table public.consegne_evento add constraint consegne_evento_testo_check
  check (testo is null or (char_length(btrim(testo)) >= 200 and char_length(testo) <= 4000));
alter table public.consegne_evento add constraint consegne_evento_testo_o_rimosso check ((testo is null) = (testo_rimosso_il is not null));

alter table public.domande_live alter column testo drop not null;
alter table public.domande_live add column if not exists testo_rimosso_il timestamptz;
alter table public.domande_live drop constraint if exists domande_live_testo_check;
alter table public.domande_live add constraint domande_live_testo_check
  check (testo is null or (char_length(testo) <= 500 and char_length(btrim(testo)) > 0));
alter table public.domande_live add constraint domande_live_testo_o_rimosso check ((testo is null) = (testo_rimosso_il is not null));

alter table public.messaggi_enti alter column corpo drop not null;
alter table public.messaggi_enti add column if not exists testo_rimosso_il timestamptz;
alter table public.messaggi_enti drop constraint if exists messaggi_enti_corpo_check;
alter table public.messaggi_enti add constraint messaggi_enti_corpo_check
  check (corpo is null or (char_length(corpo) <= 2000 and char_length(btrim(corpo)) > 0));
alter table public.messaggi_enti add constraint messaggi_enti_corpo_o_rimosso check ((corpo is null) = (testo_rimosso_il is not null));

alter table public.workshop_messaggi alter column contenuto drop not null;
alter table public.workshop_messaggi add column if not exists testo_rimosso_il timestamptz;
alter table public.workshop_messaggi drop constraint if exists workshop_messaggi_contenuto_check;
alter table public.workshop_messaggi add constraint workshop_messaggi_contenuto_check
  check (contenuto is null or (char_length(contenuto) > 0 and char_length(contenuto) <= 2000));
alter table public.workshop_messaggi add constraint workshop_messaggi_contenuto_o_rimosso check ((contenuto is null) = (testo_rimosso_il is not null));

alter table public.workshop_chat_cliente alter column contenuto drop not null;
alter table public.workshop_chat_cliente add column if not exists testo_rimosso_il timestamptz;
alter table public.workshop_chat_cliente drop constraint if exists workshop_chat_cliente_contenuto_check;
alter table public.workshop_chat_cliente add constraint workshop_chat_cliente_contenuto_check
  check (contenuto is null or (char_length(contenuto) > 0 and char_length(contenuto) <= 2000));
alter table public.workshop_chat_cliente add constraint workshop_chat_cliente_contenuto_o_rimosso check ((contenuto is null) = (testo_rimosso_il is not null));

alter table public.evidence alter column motivazione drop not null;
alter table public.evidence add column if not exists testo_rimosso_il timestamptz;
alter table public.evidence add constraint evidence_motivazione_o_rimossa check ((motivazione is null) = (testo_rimosso_il is not null));

-- 2. Dei giudizi restano i numeri.
create or replace function public.solo_numeri(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then null
    else coalesce((select jsonb_object_agg(k, v) from jsonb_each(p) as e(k, v) where jsonb_typeof(v) = 'number'), '{}'::jsonb) end;
$$;
revoke all on function public.solo_numeri(jsonb) from public, anon, authenticated;

-- 3. Il trattamento, in un posto solo. Ogni tabella in cascata da `profiles`
--    è nominata in supabase/conservare-alla-cancellazione.json; qui ci sono
--    quelle a cui succede qualcosa. Le altre sono fatti, e restano come sono.
create or replace function public.conserva_alla_cancellazione(p_uid uuid, p_nome text, p_cognome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (d) Il nome sulle ore e sugli attestati, PRIMA di toccare il profilo.
  update public.iscrizioni_eventi ie
     set nome_alla_cancellazione = case when ie.stato = 'partecipato' then pr.nome else p_nome end,
         cognome_alla_cancellazione = case when ie.stato = 'partecipato' then pr.cognome else p_cognome end
    from public.profiles pr, public.eventi e
   where pr.id = p_uid and ie.student_id = p_uid and e.id = ie.evento_id and e.data_inizio <= now();
  update public.attestati a
     set nome_alla_cancellazione = pr.nome, cognome_alla_cancellazione = pr.cognome
    from public.profiles pr
   where pr.id = p_uid and a.user_id = p_uid;

  -- (c) I rapporti.
  update public.seguiti set chiuso_il = now() where student_id = p_uid and chiuso_il is null;
  update public.manifestazioni_interesse set revocata_il = now() where student_id = p_uid and revocata_il is null;
  update public.conversazioni_enti set stato = 'account_cancellato' where student_id = p_uid;
  update public.workshop_iscrizioni set stato = 'ritirato' where student_id = p_uid and stato = 'attivo';
  -- Una tappa consegnata e non ancora revisionata non si revisiona più: il
  -- testo non c'è. Torna aperta; `consegnata_at` resta, ed è il fatto.
  update public.workshop_fasi_stato f set stato = 'aperta'
    from public.workshop_iscrizioni wi
   where wi.id = f.iscrizione_id and wi.student_id = p_uid and f.stato = 'consegnata';
  update public.newsletter_consegne set stato = 'scaduta', ultimo_errore = 'account_cancellato'
   where student_id = p_uid and stato = 'da_inviare';
  delete from public.iscrizioni_eventi ie using public.eventi e
   where e.id = ie.evento_id and ie.student_id = p_uid and e.data_inizio > now();
  delete from public.newsletter_iscrizioni where student_id = p_uid;
  delete from public.newsletter_docenti where user_id = p_uid;
  delete from public.classi_studenti where student_id = p_uid;
  delete from public.notifiche_studenti where student_id = p_uid;
  delete from public.codici_consenso_kireo where profile_id = p_uid;
  delete from public.player_live_stato where user_id = p_uid;
  delete from public.assistente_richieste where student_id = p_uid;
  delete from public.school_staff where user_id = p_uid;
  delete from public.institution_profiles where user_id = p_uid;

  -- (b) I testi. Suoi.
  update public.journal_entry set testo = null, testo_rimosso_il = now() where student_id = p_uid and testo is not null;
  update public.portfolio_item set titolo = null, contenuto = '{}'::jsonb, testo_rimosso_il = now() where student_id = p_uid and titolo is not null;
  update public.consegne_evento set testo = null, testo_rimosso_il = now() where student_id = p_uid and testo is not null;
  update public.domande_live set testo = null, testo_rimosso_il = now() where user_id = p_uid and testo is not null;
  update public.messaggi_enti m set corpo = null, testo_rimosso_il = now()
    from public.conversazioni_enti c
   where c.id = m.conversazione_id and c.student_id = p_uid and m.mittente = 'studente' and m.corpo is not null;
  update public.workshop_messaggi set contenuto = null, testo_rimosso_il = now() where mittente_id = p_uid and contenuto is not null;
  update public.step_response s set payload = s.payload - 'testo'
    from public.mission_attempt ma
   where ma.id = s.attempt_id and ma.student_id = p_uid and s.payload ? 'testo';
  -- La chat col cliente: tutte e due le metà, perché quella del cliente è
  -- nostra e lo cita.
  update public.workshop_chat_cliente c set contenuto = null, testo_rimosso_il = now()
    from public.workshop_iscrizioni wi
   where wi.id = c.iscrizione_id and wi.student_id = p_uid and c.contenuto is not null;
  update public.workshop_elaborati el set contenuto = '{}'::jsonb, feedback_ai = public.solo_numeri(el.feedback_ai)
    from public.workshop_iscrizioni wi
   where wi.id = el.iscrizione_id and wi.student_id = p_uid;
  -- Nostri su di lui: la frase esce, il numero resta.
  update public.evidence set motivazione = null, testo_rimosso_il = now() where student_id = p_uid and motivazione is not null;
  update public.workshop_fasi_stato f set revisione = public.solo_numeri(f.revisione), reazione_cliente = null
    from public.workshop_iscrizioni wi
   where wi.id = f.iscrizione_id and wi.student_id = p_uid;
  update public.workshop_consegne c set feedback_ai = public.solo_numeri(c.feedback_ai)
    from public.workshop_iscrizioni wi
   where wi.id = c.iscrizione_id and wi.student_id = p_uid;
end;
$$;
revoke all on function public.conserva_alla_cancellazione(uuid, text, text) from public, anon, authenticated;

-- 4. Lo stato dice anche quale dei tre esiti aspetta la persona.
create or replace function public.stato_cancellazione_account(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ruolo public.profile_role;
  v_tutor int;
  v_firme jsonb;
  v_totale bigint;
begin
  select ruolo into v_ruolo from public.profiles where id = p_uid and cancellato_il is null;
  if v_ruolo is null then
    return jsonb_build_object('puo', false, 'motivo', 'profilo_mancante');
  end if;
  if v_ruolo in ('admin', 'istituzione') then
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'ruolo_non_previsto');
  end if;

  if exists (select 1 from public.school_staff where user_id = p_uid and ruolo_staff = 'referente' and attivo) then
    select count(*) into v_tutor
    from public.school_staff me
    join public.school_staff t on t.scuola_profilo_id = me.scuola_profilo_id
    where me.user_id = p_uid and me.ruolo_staff = 'referente' and me.attivo
      and t.ruolo_staff = 'tutor' and t.attivo and t.user_id is not null and t.user_id <> p_uid;
    return jsonb_build_object('ruolo', v_ruolo, 'puo', false, 'motivo', 'referente_senza_successore', 'tutor_attivi', v_tutor);
  end if;

  v_firme := public.firme_di_un_account(p_uid);
  select coalesce(sum((f ->> 'n')::bigint), 0) into v_totale from jsonb_array_elements(v_firme) f;
  return jsonb_build_object('ruolo', v_ruolo, 'puo', true, 'motivo', null,
    'resta_il_nome', v_totale > 0, 'firme', v_firme,
    'esito', case when v_totale > 0 then 'cancellato_resta_il_nome'
                  when v_ruolo in ('studente', 'docente') then 'anonimizzato'
                  else 'cancellato' end);
end;
$$;
revoke all on function public.stato_cancellazione_account(uuid) from public, anon, authenticated;

-- 5. La cancellazione.
create or replace function public.cancella_account(p_uid uuid, p_resta_il_nome_visto boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stato jsonb;
  v_esito text;
  v_email text;
  v_numero integer;
  v_nome text;
  v_cognome text;
begin
  v_stato := public.stato_cancellazione_account(p_uid);
  if not coalesce((v_stato ->> 'puo')::boolean, false) then
    raise exception '%', v_stato ->> 'motivo';
  end if;
  if p_resta_il_nome_visto is not null and p_resta_il_nome_visto <> (v_stato ->> 'resta_il_nome')::boolean then
    raise exception 'stato_cambiato';
  end if;
  v_esito := v_stato ->> 'esito';

  -- Lo staff senza firme: per intero, come prima.
  if v_esito = 'cancellato' then
    delete from auth.users where id = p_uid;
    return jsonb_build_object('esito', 'cancellato');
  end if;

  if v_esito = 'cancellato_resta_il_nome' then
    select lower(btrim(email)) into v_email from auth.users where id = p_uid;
    if v_email is null or v_email = '' then
      raise exception 'indirizzo_mancante';
    end if;
    select nome, cognome into v_nome, v_cognome from public.profiles where id = p_uid;
  else
    v_numero := nextval('public.profili_anonimi_seq');
    v_nome := case when v_stato ->> 'ruolo' = 'docente' then 'Docente' else 'Studente' end;
    v_cognome := '#' || v_numero;
  end if;

  perform public.conserva_alla_cancellazione(p_uid, v_nome, v_cognome);

  update public.profiles
  set cancellato_il = now(), data_nascita = null, telefono = null,
      comunicazioni_kireo = null, comunicazioni_kireo_il = null,
      nome = v_nome, cognome = v_cognome, numero_anonimo = v_numero
  where id = p_uid;

  if v_esito = 'cancellato_resta_il_nome' then
    insert into public.indirizzi_delle_lapidi (profile_id, email) values (p_uid, v_email);
  end if;

  -- Il profilo ha `cancellato_il`: il trigger su auth.users lo lascia stare.
  delete from auth.users where id = p_uid;
  return jsonb_build_object('esito', v_esito);
end;
$$;
revoke all on function public.cancella_account(uuid, boolean) from public, anon, authenticated;
comment on function public.delete_own_account(boolean) is
  '20261204110000: conservare tutto, togliere il nome. Chi ha firmato lascia la lapide con l''indirizzo; studente e docente senza firme diventano anonimi; lo staff senza firme si cancella per intero.';

-- 6. Il tetto sulla domanda della registrazione: 10 in un'ora per rete.
create or replace function public.controlla_indirizzo_registrazione(p_email text, p_impronta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chiave text;
begin
  if p_impronta is null or p_impronta = '' then
    raise exception 'impronta_mancante';
  end if;
  v_chiave := 'registrazione:' || p_impronta;
  delete from public.tentativi_codice_invito where created_at < now() - interval '1 day';
  if public.tentativi_invito_sbagliati(v_chiave) >= 10 then
    return jsonb_build_object('esito', 'troppi_tentativi');
  end if;
  -- `riuscito` false su ogni domanda: qui non c'è una risposta giusta, si
  -- contano le domande.
  insert into public.tentativi_codice_invito (chiave, riuscito) values (v_chiave, false);
  return jsonb_build_object('esito', case when public.indirizzo_di_un_account_cancellato(p_email) then 'cancellato' else 'libero' end);
end;
$$;
revoke all on function public.controlla_indirizzo_registrazione(text, text) from public, anon, authenticated;
grant execute on function public.controlla_indirizzo_registrazione(text, text) to service_role;

-- 7. L'iscrizione d'ufficio: chi ha cancellato l'account non si iscrive, e si conta a parte.
create or replace function public.iscrivi_studenti_evento(p_evento_id uuid, p_student_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chiesti uuid[];
  v_scuola text;
  v_iscritti integer;
  v_gia integer;
  v_non_verificati integer;
  v_altra integer;
  v_cancellati integer;
begin
  if not public.current_ha_permesso_staff('gestione_classi') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (select 1 from public.eventi where id = p_evento_id and stato = 'approvato') then
    raise exception 'evento_non_disponibile';
  end if;

  v_scuola := public.current_scuola_id();
  select coalesce(array_agg(distinct x), '{}') into v_chiesti from unnest(coalesce(p_student_ids, '{}')) x;

  select count(*) into v_altra
  from unnest(v_chiesti) c
  where not exists (select 1 from public.student_profiles sp where sp.user_id = c and sp.school_code = v_scuola);

  select count(*) into v_cancellati
  from public.student_profiles sp
  join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is not null
  where sp.user_id = any (v_chiesti) and sp.school_code = v_scuola;

  select count(*) into v_non_verificati
  from public.student_profiles sp
  join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
  where sp.user_id = any (v_chiesti) and sp.school_code = v_scuola and sp.stato_verifica is distinct from 'verificato';

  select count(*) into v_gia
  from public.student_profiles sp
  join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
  join public.iscrizioni_eventi ie on ie.student_id = sp.user_id and ie.evento_id = p_evento_id
  where sp.user_id = any (v_chiesti) and sp.school_code = v_scuola and sp.stato_verifica = 'verificato';

  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, iscritto_da)
  select sp.user_id, p_evento_id, 'iscritto', 'scuola', auth.uid()
  from public.student_profiles sp
  join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
  where sp.user_id = any (v_chiesti)
    and sp.stato_verifica = 'verificato'
    and sp.school_code = v_scuola
  on conflict (student_id, evento_id) do nothing;
  get diagnostics v_iscritti = row_count;

  return jsonb_build_object(
    'iscritti', v_iscritti,
    'gia_iscritti', v_gia,
    'non_verificati', v_non_verificati,
    'altra_scuola', v_altra,
    'account_cancellati', v_cancellati
  );
end;
$$;

-- 8. I lettori di una persona non la vedono più; i registri dei fatti mostrano
--    il nome copiato o l'etichetta. Le definizioni qui sotto sono quelle vive,
--    con una riga cambiata ciascuna (detta accanto al nome).

-- studenti_della_scuola: chi ha cancellato l'account non è più un suo studente da verificare.
CREATE OR REPLACE FUNCTION public.studenti_della_scuola()
 RETURNS TABLE(user_id uuid, nome text, cognome text, classe text, stato_verifica stato_verifica_studente, dichiarato_il timestamp with time zone, verificato_il timestamp with time zone, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select sp.user_id,
         p.nome,
         p.cognome,
         sp.classe,
         sp.stato_verifica,
         sp.created_at,
         case when sp.stato_verifica = 'verificato' then sp.verificato_il end,
         u.email::text
  from public.student_profiles sp
  join public.profiles p on p.id = sp.user_id and p.ruolo = 'studente' and p.cancellato_il is null
  left join auth.users u on u.id = sp.user_id
  where public.current_ruolo_staff() in ('referente', 'tutor')
    and public.current_scuola_id() is not null
    and sp.school_code = public.current_scuola_id()
    and sp.stato_verifica in ('dichiarato', 'verificato');
$function$;

-- invia_messaggio_scuola: un messaggio a tutta la scuola o a una selezione non arriva a chi ha cancellato l'account.
CREATE OR REPLACE FUNCTION public.invia_messaggio_scuola(p_destinatari text, p_oggetto text, p_corpo text, p_classe_id uuid DEFAULT NULL::uuid, p_student_ids uuid[] DEFAULT NULL::uuid[], p_canale text DEFAULT 'interno'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scuola_profilo_id uuid := public.current_scuola_profilo_id();
  v_messaggio_id uuid;
begin
  if not public.current_ha_permesso_staff('comunicazioni') then
    raise exception 'non_autorizzato';
  end if;

  if p_destinatari not in ('tutta_scuola', 'classe', 'selezione') then
    raise exception 'destinatari_non_validi';
  end if;

  if p_destinatari = 'classe' and (
    p_classe_id is null or not exists (select 1 from public.classi where id = p_classe_id and scuola_profilo_id = v_scuola_profilo_id)
  ) then
    raise exception 'classe_non_valida';
  end if;

  v_messaggio_id := gen_random_uuid();
  insert into public.messaggi_scuola (id, scuola_profilo_id, mittente_user, destinatari, classe_id, oggetto, corpo, canale)
  values (v_messaggio_id, v_scuola_profilo_id, auth.uid(), p_destinatari, p_classe_id, p_oggetto, p_corpo, coalesce(p_canale, 'interno'));

  if p_destinatari = 'tutta_scuola' then
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, sp.user_id
    from public.student_profiles sp
    join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
    where sp.stato_verifica = 'verificato' and sp.school_code = public.current_scuola_id();
  elsif p_destinatari = 'classe' then
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, cs.student_id
    from public.classi_studenti cs
    where cs.classe_id = p_classe_id;
  else
    insert into public.messaggi_scuola_destinatari (messaggio_id, student_id)
    select v_messaggio_id, sp.user_id
    from public.student_profiles sp
    join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
    where sp.user_id = any (coalesce(p_student_ids, array[]::uuid[]))
      and sp.stato_verifica = 'verificato'
      and sp.school_code = public.current_scuola_id();
  end if;
end;
$function$;

-- check_studente_verificato_stessa_scuola: non si mette in una classe chi ha cancellato l'account.
CREATE OR REPLACE FUNCTION public.check_studente_verificato_stessa_scuola()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_scuola_classe text;
begin
  select scuola_id into v_scuola_classe
  from public.scuole_profili sp
  join public.classi c on c.scuola_profilo_id = sp.id
  where c.id = new.classe_id;

  if not exists (
    select 1 from public.student_profiles sp
    join public.profiles pv on pv.id = sp.user_id and pv.cancellato_il is null
    where sp.user_id = new.student_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = v_scuola_classe
  ) then
    raise exception 'studente_non_verificato_o_scuola_diversa';
  end if;

  return new;
end;
$function$;

-- conteggio_follower: chi segue adesso: un rapporto chiuso non conta.
CREATE OR REPLACE FUNCTION public.conteggio_follower(p_istituzione_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer from public.seguiti where istituzione_id = p_istituzione_id and chiuso_il is null;
$function$;

-- notifica_follower_evento_approvato: non si notifica un rapporto chiuso.
CREATE OR REPLACE FUNCTION public.notifica_follower_evento_approvato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.stato = 'approvato' and old.stato is distinct from 'approvato'
     and new.organizzatore_id is not null and new.pubblico = 'studenti'
  then
    if exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = new.organizzatore_id and p.nome <> 'free'
    ) then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select s.student_id, 'nuovo_evento_ente', new.id
      from public.seguiti s
      where s.istituzione_id = new.organizzatore_id and s.chiuso_il is null;
    end if;
  end if;
  return new;
end;
$function$;

-- notifiche_post_enti: non si notifica un rapporto chiuso.
CREATE OR REPLACE FUNCTION public.notifiche_post_enti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_divenuto_visibile boolean;
begin
  v_divenuto_visibile := public.post_stato_visibile(new.stato)
    and (tg_op = 'INSERT' or not public.post_stato_visibile(old.stato));

  if v_divenuto_visibile then
    if exists (
      select 1 from public.istituzioni i
      join public.piani p on p.id = i.piano_id
      where i.id = new.istituzione_id and p.nome <> 'free'
    ) then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select s.student_id, 'nuovo_post', new.id
      from public.seguiti s
      where s.istituzione_id = new.istituzione_id and s.chiuso_il is null;
    end if;
    if tg_op = 'INSERT' then
      insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
      select p.id, 'post_pubblicato', new.id
      from public.profiles p
      where p.ruolo = 'admin';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.stato = 'tolto' and old.stato is distinct from 'tolto' then
    insert into public.notifiche_studenti (student_id, tipo, riferimento_id)
    select ip.user_id, 'post_tolto', new.id
    from public.institution_profiles ip
    where ip.istituzione_id = new.istituzione_id;
  end if;
  return new;
end;
$function$;

-- scheda_admin_ente: chi lo segue adesso.
CREATE OR REPLACE FUNCTION public.scheda_admin_ente(p_istituzione_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;
  if not exists (select 1 from public.istituzioni where id = p_istituzione_id) then
    return null;
  end if;
  select jsonb_build_object(
    'seguaci_studenti', (
      select count(*) from public.seguiti s join public.profiles p on p.id = s.student_id
      where s.istituzione_id = p_istituzione_id and s.chiuso_il is null and p.ruolo = 'studente'
    ),
    'seguaci_altri', (
      select count(*) from public.seguiti s join public.profiles p on p.id = s.student_id
      where s.istituzione_id = p_istituzione_id and s.chiuso_il is null and p.ruolo is distinct from 'studente'
    ),
    'account', coalesce((
      select jsonb_agg(jsonb_build_object('nome', p.nome, 'cognome', p.cognome, 'email', u.email::text, 'dal', ip.created_at) order by ip.created_at)
      from public.institution_profiles ip
      join public.profiles p on p.id = ip.user_id
      left join auth.users u on u.id = ip.user_id
      where ip.istituzione_id = p_istituzione_id
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$function$;

-- statistiche_ente: «raggiunti dall'inizio» conta anche un profilo condiviso poi revocato: non scende.
CREATE OR REPLACE FUNCTION public.statistiche_ente(p_istituzione_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_k integer := public.soglia_anonimato_statistiche();
  v_mese date := date_trunc('month', now() at time zone 'Europe/Rome')::date;
  v_inizio_mese timestamptz := (date_trunc('month', now() at time zone 'Europe/Rome')) at time zone 'Europe/Rome';
  v_eventi jsonb;
  v_lista jsonb;
  v_studenti jsonb;
  v_newsletter jsonb;
  v_guide jsonb;
begin
  if not (coalesce(public.current_ruolo() = 'admin', false)
          or coalesce(p_istituzione_id = public.current_istituzione_id(), false)) then
    raise exception 'non_autorizzato';
  end if;

  -- ── Eventi: gli approvati dell'ente. Passato vuol dire finito davvero
  -- (la fine effettiva, la stessa regola di ogni «è finito?»).
  with ev as (
    select e.id, e.titolo, e.data_inizio, e.tipo::text as tipo,
           coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now() as passato,
           public.durata_vera_minuti(e.id) as durata,
           (e.domanda_consegna is not null) as domanda_posta
      from public.eventi e
     where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato'
  ),
  riga as (
    select ev.*,
           (select count(*) from public.iscrizioni_eventi ie where ie.evento_id = ev.id) as iscritti,
           case when ev.tipo = 'webinar' then
             (select count(distinct pl.user_id) from public.presenze_live pl where pl.evento_id = ev.id)
           end as collegati,
           (select count(*) from public.iscrizioni_eventi ie where ie.evento_id = ev.id and ie.stato = 'partecipato') as certificate,
           (select count(*) from public.consegne_evento ce where ce.evento_id = ev.id) as risposte
      from ev
  )
  select
    jsonb_build_object(
      'in_programma', count(*) filter (where not r.passato),
      'passati', count(*) filter (where r.passato),
      'iscritti', coalesce(sum(r.iscritti), 0),
      'collegati', coalesce(sum(r.collegati), 0),
      'certificate', coalesce(sum(r.certificate), 0)
    ),
    coalesce(jsonb_agg(jsonb_build_object(
      'evento_id', r.id, 'titolo', r.titolo, 'data_inizio', r.data_inizio, 'tipo', r.tipo,
      'passato', r.passato, 'iscritti', r.iscritti, 'collegati', r.collegati,
      'certificate', r.certificate, 'risposte', r.risposte, 'domanda_posta', r.domanda_posta
    ) order by r.data_inizio desc), '[]'::jsonb)
    into v_eventi, v_lista
    from riga r;

  -- Quanti degli iscritti alle dirette finite si sono collegati, e quanto
  -- sono rimasti in media sulla durata vera (chi si è collegato, non tutti).
  v_eventi := v_eventi || (
    select jsonb_build_object(
      'iscritti_dirette_finite', count(*),
      'iscritti_collegati', count(*) filter (where exists (
        select 1 from public.presenze_live pl where pl.evento_id = ie.evento_id and pl.user_id = ie.student_id))
    )
    from public.iscrizioni_eventi ie
    join public.eventi e on e.id = ie.evento_id
    where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato' and e.tipo = 'webinar'
      and coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now()
  ) || (
    select jsonb_build_object(
      'permanenza_media_pct', round(avg(least(pl.ping_totali::numeric / d.durata, 1)) * 100),
      'permanenza_su', count(*)
    )
    from public.presenze_live pl
    join (
      select e.id, public.durata_vera_minuti(e.id) as durata
        from public.eventi e
       where e.organizzatore_id = p_istituzione_id and e.stato = 'approvato' and e.tipo = 'webinar'
         and coalesce(public.fine_effettiva_evento(e.id), e.data_inizio) < now()
    ) d on d.id = pl.evento_id
    where d.durata > 0
  ) || jsonb_build_object('lista', v_lista);

  -- ── Studenti: solo aggregato, con la soglia sulle ripartizioni.
  with gesti as (
    select r.student_id, r.created_at from public.recinto_enti r where r.istituzione_id = p_istituzione_id
    union all
    select s.student_id, s.created_at from public.seguiti s where s.istituzione_id = p_istituzione_id
    union all
    select m.student_id, m.created_at from public.manifestazioni_interesse m
     where m.istituzione_id = p_istituzione_id
    union all
    select sg.student_id, sg.created_at from public.scaricamenti_guide_enti sg where sg.istituzione_id = p_istituzione_id
  ),
  st as (
    select g.student_id, min(g.created_at) as primo
      from gesti g
      join public.profiles pr on pr.id = g.student_id and pr.ruolo = 'studente'
     group by g.student_id
  ),
  dati as (
    select st.student_id, st.primo, sp.anno_diploma::text as anno, sc.tipo_istituto::text as indirizzo, sc.provincia
      from st
      left join public.student_profiles sp on sp.user_id = st.student_id
      left join public.schools sc on sc.codice_meccanografico = sp.school_code
  ),
  gruppi as (
    select 'area' as dimensione, sai.area_slug as chiave, count(*) as n
      from dati d join public.student_area_interests sai on sai.user_id = d.student_id group by sai.area_slug
    union all select 'anno', d.anno, count(*) from dati d group by d.anno
    union all select 'indirizzo', d.indirizzo, count(*) from dati d group by d.indirizzo
    union all select 'provincia', d.provincia, count(*) from dati d group by d.provincia
  ),
  per_dimensione as (
    select g.dimensione,
           jsonb_build_object(
             'righe', coalesce(jsonb_agg(jsonb_build_object('chiave', g.chiave, 'n', g.n)
                                         order by g.n desc, g.chiave) filter (where g.n >= v_k), '[]'::jsonb),
             'altre', coalesce(sum(g.n) filter (where g.n < v_k), 0)
           ) as tabella
      from gruppi g
     group by g.dimensione
  )
  select jsonb_build_object(
    'totale', (select count(*) from dati),
    'nuovi_mese', (select count(*) from dati where primo >= v_inizio_mese),
    'soglia', v_k,
    'per_area', coalesce((select tabella from per_dimensione where dimensione = 'area'), '{"righe":[],"altre":0}'::jsonb),
    'per_anno_diploma', coalesce((select tabella from per_dimensione where dimensione = 'anno'), '{"righe":[],"altre":0}'::jsonb),
    'per_indirizzo', coalesce((select tabella from per_dimensione where dimensione = 'indirizzo'), '{"righe":[],"altre":0}'::jsonb),
    'per_provincia', coalesce((select tabella from per_dimensione where dimensione = 'provincia'), '{"righe":[],"altre":0}'::jsonb)
  ) into v_studenti;

  -- ── Newsletter.
  select jsonb_build_object(
    'iscritti', (select count(*) from public.newsletter_iscrizioni n where n.istituzione_id = p_istituzione_id),
    'raggiungibili', (select count(*) from public.newsletter_iscrizioni n join public.profiles p on p.id = n.student_id
                       where n.istituzione_id = p_istituzione_id
                         and public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)),
    'nuovi_mese', (select count(*) from public.newsletter_iscrizioni n
                    where n.istituzione_id = p_istituzione_id and n.created_at >= v_inizio_mese),
    'persi_mese', (select coalesce(sum(u.uscite), 0) from public.uscite_newsletter_giorno u
                    where u.istituzione_id = p_istituzione_id and u.giorno >= v_mese),
    'persi_contati_dal', public.inizio_conteggio_uscite_newsletter()
  ) into v_newsletter;

  -- ── Guide: ogni guida, anche archiviata, e (dal 20261116100000) anche
  -- cancellata. Una guida cancellata non c'è più in guide_enti: titolo e data
  -- vengono dal contatore, che li ha copiati al momento dello scaricamento.
  with g as (
    select g.id, g.titolo, g.created_at, g.archiviata_il, false as cancellata
      from public.guide_enti g
     where g.istituzione_id = p_istituzione_id
    union all
    (select distinct on (c.guida_id) c.guida_id, c.titolo, c.caricata_il, null::timestamptz, true
       from public.contatore_scaricamenti_guide c
      where c.istituzione_id = p_istituzione_id
        and not exists (select 1 from public.guide_enti x where x.id = c.guida_id)
      order by c.guida_id, c.giorno)
  ), gc as (
    select g.*,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c where c.guida_id = g.id) as scaricamenti,
           (select coalesce(sum(c.scaricamenti), 0) from public.contatore_scaricamenti_guide c
             where c.guida_id = g.id and c.giorno >= v_mese) as scaricamenti_mese,
           (select count(*) from public.scaricamenti_guide_enti s where s.guida_id = g.id) as studenti
      from g
  )
  select jsonb_build_object(
    'scaricamenti', coalesce(sum(gc.scaricamenti), 0),
    'scaricamenti_mese', coalesce(sum(gc.scaricamenti_mese), 0),
    'studenti', (select count(distinct s.student_id) from public.scaricamenti_guide_enti s where s.istituzione_id = p_istituzione_id),
    'contati_dal', public.inizio_conteggio_download_guide(),
    'per_guida', coalesce(jsonb_agg(jsonb_build_object(
      'guida_id', gc.id, 'titolo', gc.titolo, 'caricata_il', gc.created_at, 'archiviata_il', gc.archiviata_il,
      'cancellata', gc.cancellata, 'scaricamenti', gc.scaricamenti, 'studenti', gc.studenti
    ) order by gc.created_at desc), '[]'::jsonb)
  ) into v_guide
  from gc;

  return jsonb_build_object('eventi', v_eventi, 'studenti', v_studenti, 'newsletter', v_newsletter, 'guide', v_guide);
end;
$function$;

-- esporta_presenze_scuola: il nome copiato alla cancellazione.
CREATE OR REPLACE FUNCTION public.esporta_presenze_scuola(p_evento_id uuid)
 RETURNS TABLE(nome text, cognome text, email text, classe_nome text, primo_ping timestamp with time zone, ultimo_ping timestamp with time zone, minuti_presenza numeric, minuti_contati integer, copertura_percento numeric, stato_finale text, certificata_da_tipo text, certificata_da_nome text, ore_riconosciute numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- 26/10: la fine VERA — una diretta chiusa prima finisce alla chiusura.
  select e.data_inizio, case when e.diretta_chiusa_il is not null then least(e.data_fine, e.diretta_chiusa_il) else e.data_fine end
    into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      coalesce(ie.nome_alla_cancellazione, p.nome),
      coalesce(ie.cognome_alla_cancellazione, p.cognome),
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
      (select (cp.nome || ' ' || cp.cognome) from public.profiles cp where cp.id = ie.certificata_da_user),
      ie.ore_riconosciute
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
$function$;

-- esporta_presenze_admin: il nome copiato alla cancellazione.
CREATE OR REPLACE FUNCTION public.esporta_presenze_admin(p_evento_id uuid)
 RETURNS TABLE(nome text, cognome text, email text, scuola_denominazione text, scuola_codice text, classe_nome text, primo_ping timestamp with time zone, ultimo_ping timestamp with time zone, minuti_presenza numeric, minuti_contati integer, copertura_percento numeric, stato_finale text, certificata_da_tipo text, certificata_da_nome text, attestato_emesso boolean, attestato_codice uuid, ore_riconosciute numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ping_attesi numeric;
  v_inizio timestamptz;
  v_fine timestamptz;
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  v_ping_attesi := public.ping_attesi_evento(p_evento_id);
  -- 26/10: la fine VERA — una diretta chiusa prima finisce alla chiusura.
  select e.data_inizio, case when e.diretta_chiusa_il is not null then least(e.data_fine, e.diretta_chiusa_il) else e.data_fine end
    into v_inizio, v_fine from public.eventi e where e.id = p_evento_id;

  return query
    select
      coalesce(ie.nome_alla_cancellazione, p.nome),
      coalesce(ie.cognome_alla_cancellazione, p.cognome),
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
      att.codice_verifica,
      ie.ore_riconosciute
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
$function$;

-- verifica_attestato: il nome copiato alla cancellazione.
CREATE OR REPLACE FUNCTION public.verifica_attestato(p_codice uuid)
 RETURNS TABLE(valido boolean, nome_completo text, titolo_evento text, filone filone_docenti, data_evento timestamp with time zone, organizzatore_nome text, rilasciato_il timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (a.id is not null) as valido,
    coalesce(a.nome_alla_cancellazione || ' ' || a.cognome_alla_cancellazione, p.nome || ' ' || p.cognome) as nome_completo,
    e.titolo as titolo_evento,
    e.filone,
    e.data_inizio as data_evento,
    coalesce(i.nome, 'KIREO') as organizzatore_nome,
    a.rilasciato_il
  from (select 1) as uno
  left join public.attestati a on a.codice_verifica = p_codice
  left join public.profiles p on p.id = a.user_id
  left join public.eventi e on e.id = a.evento_id
  left join public.istituzioni i on i.id = e.organizzatore_id;
$function$;

-- 9. Si rilegge.
do $$
begin
  if to_regprocedure('public.conserva_alla_cancellazione(uuid, text, text)') is null then
    raise exception 'manca conserva_alla_cancellazione';
  end if;
  if has_function_privilege('anon', 'public.controlla_indirizzo_registrazione(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.controlla_indirizzo_registrazione(text, text)', 'execute') then
    raise exception 'controlla_indirizzo_registrazione è aperta al client';
  end if;
  if has_column_privilege('authenticated', 'public.domande_live', 'testo_rimosso_il', 'INSERT') then
    raise exception 'il client può scrivere testo_rimosso_il';
  end if;
  if obj_description('public.delete_own_account(boolean)'::regprocedure) not like '20261204110000:%' then
    raise exception 'delete_own_account non porta il commento di 20261204110000';
  end if;
  if position('chiuso_il' in pg_get_functiondef('public.conteggio_follower(uuid)'::regprocedure)) = 0 then
    raise exception 'conteggio_follower non guarda chiuso_il';
  end if;
end $$;
