-- 20261205100000 — Il nome copiato solo sulle presenze certificate, e la
-- chiusura dell'admin che non sovrascrive «account cancellato».
--
-- Dal giro a schermo di Mario del 03/11, con test8 cancellato in produzione:
--
-- 1. `iscrizioni_eventi.nome_alla_cancellazione` portava «Studente»/«#1» sulle
--    righe NON certificate. Non era un ordine di operazioni: lo scriveva il
--    `case … else p_nome` di 20261204110000, apposta, ed era sbagliato. Una
--    colonna che si chiama «nome alla cancellazione» non porta un'etichetta.
--    Regola di Mario: «o il nome vero su tutte, o il vuoto dove non serve».
--    Il vuoto: il nome copiato serve solo dove un registro deve continuare a
--    dire chi era (le ore certificate); altrove la riga è un fatto anonimo, e
--    chi la mostra prende l'etichetta dal profilo. Gli attestati copiavano già
--    il nome vero senza condizioni: nessun'altra colonna è toccata.
--    Le righe già scritte si correggono qui, e un vincolo tiene la regola sul
--    posto: nessuna strada riporta una presenza da «partecipato» a «iscritto»
--    (cercato il 03/11), quindi il vincolo non chiude niente che serva.
--
-- 2. `chiudi_conversazione_admin` sovrascriveva qualunque stato con
--    «chiusa_da_admin», anche «account_cancellato»: l'ente avrebbe letto
--    «chiusa da KIREO» al posto della frase di Mario. Ora una conversazione
--    di un account cancellato si rifiuta con un errore suo.
--
-- Da applicare quando vuoi, prima o dopo il deploy: il codice di prima non
-- scrive nessuna delle due cose, e quello nuovo regge anche senza.

-- 1a. La funzione, uguale a 20261204110000 tranne la copia del nome.
create or replace function public.conserva_alla_cancellazione(p_uid uuid, p_nome text, p_cognome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (d) Il nome vero, copiato PRIMA di toccare il profilo, e solo dove serve:
  --     sulle presenze certificate (le ore) e sugli attestati. Una riga non
  --     certificata non riceve niente: il suo nome, se serve, lo mostra il
  --     profilo, che da qui in poi porta l'etichetta anonima (20261205100000).
  --     `p_nome` e `p_cognome` (l'etichetta) restano nella firma per chi la
  --     chiama, e qui non si scrivono più su nessuna riga.
  update public.iscrizioni_eventi ie
     set nome_alla_cancellazione = pr.nome,
         cognome_alla_cancellazione = pr.cognome
    from public.profiles pr, public.eventi e
   where pr.id = p_uid and ie.student_id = p_uid and e.id = ie.evento_id and e.data_inizio <= now()
     and ie.stato = 'partecipato';
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

-- 1b. Le righe già scritte: via l'etichetta dalle righe non certificate.
do $$
declare
  n integer;
begin
  update public.iscrizioni_eventi
     set nome_alla_cancellazione = null, cognome_alla_cancellazione = null
   where stato <> 'partecipato'
     and (nome_alla_cancellazione is not null or cognome_alla_cancellazione is not null);
  get diagnostics n = row_count;
  raise notice '20261205100000: righe non certificate ripulite: %', n;
end $$;

alter table public.iscrizioni_eventi
  add constraint iscrizioni_eventi_nome_copiato_solo_se_certificata
  check ((nome_alla_cancellazione is null and cognome_alla_cancellazione is null) or stato = 'partecipato');

comment on column public.iscrizioni_eventi.nome_alla_cancellazione is
  '20261205100000: il nome vero copiato alla cancellazione dell''account, solo su una presenza certificata. Altrove è null, mai un''etichetta.';

-- 2. La chiusura dell'admin.
create or replace function public.chiudi_conversazione_admin(p_conversazione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_ruolo() is distinct from 'admin' then
    raise exception 'non_autorizzato';
  end if;

  if exists (select 1 from public.conversazioni_enti where id = p_conversazione_id and stato = 'account_cancellato') then
    raise exception 'conversazione_account_cancellato';
  end if;

  update public.conversazioni_enti set stato = 'chiusa_da_admin' where id = p_conversazione_id;
end;
$$;
comment on function public.chiudi_conversazione_admin(uuid) is
  '20261205100000: non sovrascrive una conversazione chiusa dalla cancellazione di un account.';

-- 3. Si rilegge.
do $$
begin
  if exists (select 1 from public.iscrizioni_eventi where stato <> 'partecipato' and nome_alla_cancellazione is not null) then
    raise exception '20261205100000: restano righe non certificate con un nome copiato';
  end if;
  if not (select convalidated from pg_constraint where conname = 'iscrizioni_eventi_nome_copiato_solo_se_certificata') then
    raise exception '20261205100000: il vincolo non è validato';
  end if;
  if position('ie.stato = ''partecipato''' in pg_get_functiondef('public.conserva_alla_cancellazione(uuid, text, text)'::regprocedure)) = 0 then
    raise exception '20261205100000: conserva_alla_cancellazione copia ancora il nome su ogni riga';
  end if;
  if coalesce(obj_description('public.chiudi_conversazione_admin(uuid)'::regprocedure), '') not like '20261205100000:%' then
    raise exception '20261205100000: chiudi_conversazione_admin non è quella nuova';
  end if;
end $$;
