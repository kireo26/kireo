-- IL ROVESCIAMENTO: IL CLIENT NON SCRIVE NIENTE, TRANNE QUELLO CHE SCRIVE DAVVERO
-- (Mario, 27/10: «non sono 35 difetti, è un'abitudine con 35 istanze»; il
-- censimento è in CLAUDE.md, «Il censimento delle colonne che il client scrive»;
-- le quattro peggiori le ha chiuse 20261105100000, vista a schermo il 28/10).
--
-- Fino a oggi il valore di partenza era «tutte le colonne»: Supabase concede ad
-- anon e authenticated ogni privilegio su ogni tabella nuova, e una policy diceva
-- CHI poteva scrivere una riga tacendo su COSA della riga. 35 tabelle su 41
-- concedevano tutto; le sei che no avevano ristretto le colonne DOPO una falla.
--
-- Qui si rovescia il valore di partenza, in tre pezzi:
--   1. `revoke insert, update` su TUTTE le tabelle di public, per anon e
--      authenticated. Il revoke sulla tabella toglie anche i privilegi di
--      colonna [misurato sulla replica il 28/10], quindi dopo questa riga non
--      resta niente;
--   2. i privilegi PREDEFINITI rovesciati: una tabella creata dopo questa
--      migrazione nasce chiusa per il client. È la fabbrica che Mario ha chiesto
--      di chiudere: senza, il rovesciamento sarebbe una pulizia, e la
--      trentaseiesima tabella nascerebbe come le prime 35. Una colonna nuova di
--      una tabella esistente nasce chiusa da sé (i privilegi di colonna sono per
--      colonna);
--   3. le colonne concesse una per una, quelle che il codice scrive davvero
--      (lette il 28/10 in app/, lib/, components/, nel banco, e nelle quattro
--      funzioni NON definer che scrivono con i privilegi di chi chiama:
--      finalize_registration, crea_invito_tutor, invia_messaggio_scuola,
--      approva_richiesta_upgrade). Il registro è `supabase/colonne-del-client.json`,
--      con chi scrive ogni tabella; `npm run test:colonne` lo confronta con le
--      concessioni di questo file e delle migrazioni dopo, con le scritture del
--      codice, e sulla replica con i privilegi veri.
--
-- ⚠️ CONSEGUENZE, scritte perché si leggano:
--   · una schermata nuova che scrive una colonna non concessa fallisce con
--     «permission denied». È il verso rumoroso, ed è voluto. La cura è una
--     migrazione con il grant e una riga nel registro, mai un grant di tabella;
--   · i privilegi sono per ruolo, quindi valgono anche per l'admin collegato dal
--     client: le colonne che l'admin scrive dal client (stato, note di revisione,
--     il video, le convenzioni, «gestita») sono concesse a tutto authenticated, e
--     a restringerle per riga restano le policy e i trigger di prima;
--   · DELETE non c'entra (non ha colonne) e SELECT non si tocca;
--   · CHIUSE, perché nessun codice le scriveva, porte che il censimento aveva
--     trovato: `consegne_evento.letture_tentate`/`valutata_il`,
--     `domande_live.stato`/`creata_il`, `post_enti.approvato_*` all'insert,
--     `richieste_contatto.gestita`/`created_at` all'insert (anche per anon),
--     `recinto_enti.created_at`, `workshop_elaborati.fiducia`,
--     `workshop_consegne.feedback_ai` (il client non ci scrive più niente),
--     `manifestazioni_interesse.istituzione_id` all'update,
--     `messaggi_scuola_destinatari.messaggio_id` all'update (la metà «update»
--     della falla in quarantena), `richieste_upgrade.note_kireo` all'insert, e
--     l'update di una bozza da parte dell'ente (`eventi` all'update tiene solo le
--     quattro colonne che l'admin scrive: nessuna schermata dell'ente modifica
--     una bozza dal client; lo spostamento passa da sposta_finestra_evento);
--   · RESTANO APERTE, perché il codice le scrive: `eventi.incorporamento_sonda` e
--     `checklist_diretta_accettata_il` (le scrive il form dell'ente),
--     `activity_log.peso`, `school_staff.codice_invito` (crea_invito_tutor non è
--     definer), gli `attempt_id` di journal_entry/portfolio_item (in
--     quarantena). Le chiude un altro lavoro, non un privilegio.
--
-- COME SI VERIFICA APPLICATA (la migrazione rilegge da sé e si ferma se non torna):
--   select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r'
--     and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
--       or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE'));   → 0
--   select n.nspname, d.defaclacl from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
--   where d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'r';
--     → per public e per storage, anon e authenticated senza «a» e senza «w»
--     (le righe di supabase_admin restano com'erano: sono di Supabase)
--   e `scripts/diagnostica-colonne-del-client.sql`: 199 colonne scrivibili, tutte nel registro.

-- ── 1 · si toglie tutto ──────────────────────────────────────────────────────
revoke insert, update on all tables in schema public from anon, authenticated;

-- ── 2 · la fabbrica ──────────────────────────────────────────────────────────
alter default privileges in schema public revoke insert, update on tables from anon, authenticated;
-- E `storage`: in produzione `postgres` ha lì la stessa riga (arwdDxtm per anon e
-- authenticated, misurata da Mario il 28/10), cioè una tabella creata da noi in
-- `storage` nascerebbe scrivibile dal client. Oggi lì non creiamo niente; la
-- fabbrica però è la stessa. Il 28/10 il primo tentativo di questa migrazione si è
-- fermato proprio su quella riga, che il controllo qui sotto non sapeva nominare.
-- Lo schema c'è in produzione e nello shim; il `do` lo rende innocuo dove manca.
do $$
begin
  if to_regnamespace('storage') is not null then
    execute 'alter default privileges in schema storage revoke insert, update on tables from anon, authenticated';
  end if;
end $$;

-- ── 3 · le colonne che il client scrive davvero ──────────────────────────────
-- richieste_contatto: app/api/richiesta-contatto/route.ts (il modulo pubblico, senza sessione)
grant insert (origine, nome, ruolo, istituto, codice_meccanografico, email, messaggio) on public.richieste_contatto to anon;
-- activity_log: lib/app/activityLog.ts, app/api/assistente/route.ts
grant insert (student_id, area_slug, tipo_attivita, peso, livello) on public.activity_log to authenticated;
-- assistente_conversazioni: app/api/assistente/route.ts
grant insert (student_id, area_slug) on public.assistente_conversazioni to authenticated;
-- assistente_richieste: app/api/assistente/route.ts (il tetto, scritto prima della chiamata)
grant insert (student_id) on public.assistente_richieste to authenticated;
-- classi: components/scuola/CreaClasseForm.tsx
grant insert (scuola_profilo_id, anno, sezione, nome_visualizzato) on public.classi to authenticated;
-- classi_studenti: components/scuola/GestioneClasseStudenti.tsx
grant insert (classe_id, student_id) on public.classi_studenti to authenticated;
-- comunicazioni: components/ente/CreaComunicazioneForm.tsx (insert), components/admin/AzioneApprovazione.tsx (update, l'admin)
grant insert (istituzione_id, tipo, oggetto, corpo, stato) on public.comunicazioni to authenticated;
grant update (stato, note_revisione) on public.comunicazioni to authenticated;
-- consegne_evento: app/api/eventi/[id]/consegna/route.ts
grant insert (evento_id, student_id, testo) on public.consegne_evento to authenticated;
-- domande_live: components/live/BoxDomandeLive.tsx
grant insert (evento_id, user_id, testo) on public.domande_live to authenticated;
-- eventi: components/ente/CreaEventoForm.tsx (insert), components/admin/AzioneApprovazione.tsx e components/admin/GestisciVideoDirettaForm.tsx (update, l'admin)
grant insert (titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti, cta_esterna_url, stato, pubblico, filone, hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, incorporamento_sonda, proposta_incontro_id) on public.eventi to authenticated;
grant update (stato, note_revisione, youtube_video_id, incorporamento_sonda) on public.eventi to authenticated;
-- eventi_aree: components/ente/CreaEventoForm.tsx
grant insert (evento_id, area_slug) on public.eventi_aree to authenticated;
-- guide_enti: components/ente/ProfiloEnteForm.tsx
grant insert (istituzione_id, titolo, pdf_url) on public.guide_enti to authenticated;
-- iscrizioni_eventi: components/app/IscrivitiEventoButton.tsx, components/docente/IscrivitiWebinarButton.tsx
grant insert (student_id, evento_id) on public.iscrizioni_eventi to authenticated;
-- istituzioni: components/ente/ProfiloEnteForm.tsx, components/ente/AccettaRegolamentoForm.tsx, lib/finalizzaRegistrazioneEnte.ts, components/admin/AttivaIstituzioneButton.tsx, approva_richiesta_upgrade (non definer: scrive con i privilegi dell'admin). Stato e piano li difende il trigger blocca_autoescalation_istituzione
grant update (descrizione, immagine_copertina_url, sito_ufficiale, provincia, regolamento_accettato_il, stato, piano_id, piano_attivato_il, piano_scade_il) on public.istituzioni to authenticated;
-- istituzioni_aree: components/ente/ProfiloEnteForm.tsx
grant insert (istituzione_id, area_slug) on public.istituzioni_aree to authenticated;
-- journal_entry: app/api/escape/finalizza/route.ts
grant insert (student_id, attempt_id, testo) on public.journal_entry to authenticated;
-- manifestazioni_interesse: components/app/ManifestazioneInteresseButton.tsx, components/app/ListaManifestazioniInteresse.tsx
grant insert (student_id, istituzione_id) on public.manifestazioni_interesse to authenticated;
grant update (revocata_il) on public.manifestazioni_interesse to authenticated;
-- messaggi_scuola: invia_messaggio_scuola (non definer: scrive con i privilegi del referente)
grant insert (id, scuola_profilo_id, mittente_user, destinatari, classe_id, oggetto, corpo, canale) on public.messaggi_scuola to authenticated;
-- messaggi_scuola_destinatari: invia_messaggio_scuola (insert), components/app/MessaggiScuola.tsx (update)
grant insert (messaggio_id, student_id) on public.messaggi_scuola_destinatari to authenticated;
grant update (letto_il) on public.messaggi_scuola_destinatari to authenticated;
-- mission_attempt: components/escape/IniziaMissione.tsx, components/escape/EscapePlayer.tsx, app/api/escape/finalizza/route.ts, il banco (giocaMissione)
grant insert (student_id, mission_slug) on public.mission_attempt to authenticated;
grant update (stanza_corrente, updated_at, revisore_esito) on public.mission_attempt to authenticated;
-- newsletter_docenti: components/docente/NewsletterToggle.tsx
grant insert (user_id) on public.newsletter_docenti to authenticated;
-- newsletter_iscrizioni: components/app/IscrivitiNewsletterButton.tsx
grant insert (student_id, istituzione_id) on public.newsletter_iscrizioni to authenticated;
-- notifiche_studenti: components/app/NotificheBell.tsx (le notifiche le scrive il cron, con la service-role)
grant update (letta) on public.notifiche_studenti to authenticated;
-- portfolio_item: app/api/escape/finalizza/route.ts
grant insert (student_id, attempt_id, titolo, contenuto) on public.portfolio_item to authenticated;
-- post_enti: components/ente/CreaPostForm.tsx (insert), components/admin/AzioneApprovazionePost.tsx (update, l'admin)
grant insert (istituzione_id, tipo, corpo, immagine_url, embed_url) on public.post_enti to authenticated;
grant update (stato, approvato_da, approvato_il, motivo_rifiuto) on public.post_enti to authenticated;
-- profiles: finalize_registration (insert, non definer), components/app/CompletaEtaForm.tsx, components/app/ProfiloForm.tsx
grant insert (id, ruolo, nome, cognome, data_nascita) on public.profiles to authenticated;
grant update (data_nascita, telefono) on public.profiles to authenticated;
-- recinto_enti: lib/app/recinto.ts (upsert con ignoreDuplicates: un insert ... on conflict do nothing)
grant insert (student_id, istituzione_id, origine) on public.recinto_enti to authenticated;
-- richieste_contatto: app/api/richiesta-contatto/route.ts (insert, anche da collegati), components/admin/ToggleGestitaRichiesta.tsx (update, l'admin)
grant insert (origine, nome, ruolo, istituto, codice_meccanografico, email, messaggio) on public.richieste_contatto to authenticated;
grant update (gestita) on public.richieste_contatto to authenticated;
-- richieste_upgrade: components/ente/RichiediUpgradeButton.tsx (insert), components/admin/AzioneApprovazioneUpgrade.tsx e approva_richiesta_upgrade (update)
grant insert (istituzione_id, piano_richiesto_id, note, stato) on public.richieste_upgrade to authenticated;
grant update (stato, note_kireo) on public.richieste_upgrade to authenticated;
-- school_staff: crea_invito_tutor (insert, non definer), components/scuola/TogglePermessiTutor.tsx, components/scuola/DisattivaStaffButton.tsx
grant insert (scuola_profilo_id, ruolo_staff, user_id, codice_invito, nome_invitato, email_invitato, creato_da) on public.school_staff to authenticated;
grant update (attivo, puo_verificare_studenti, puo_gestire_classi, puo_certificare_presenze, puo_inviare_comunicazioni) on public.school_staff to authenticated;
-- scuole_profili: components/admin/AttivaScuolaControlli.tsx (l'admin)
grant update (convenzione_firmata_il, stato) on public.scuole_profili to authenticated;
-- seguiti: components/app/SeguiButton.tsx
grant insert (student_id, istituzione_id) on public.seguiti to authenticated;
-- step_response: components/escape/EscapePlayer.tsx, il banco (giocaMissione): un upsert riscrive ogni colonna che manda, chiave del conflitto compresa
grant insert (attempt_id, stanza, step_id, tipo, payload) on public.step_response to authenticated;
grant update (attempt_id, stanza, step_id, tipo, payload) on public.step_response to authenticated;
-- student_area_interests: finalize_registration (non definer), components/app/ProfiloForm.tsx
grant insert (user_id, area_slug) on public.student_area_interests to authenticated;
-- student_profiles: finalize_registration (insert, non definer), components/app/ProfiloForm.tsx
grant insert (user_id, school_code, classe, anno_diploma) on public.student_profiles to authenticated;
grant update (school_code, classe) on public.student_profiles to authenticated;
-- teacher_profiles: finalize_registration (non definer)
grant insert (user_id, school_code, materia, is_referente_orientamento) on public.teacher_profiles to authenticated;
-- test_attempt: components/test/IniziaTest.tsx, app/api/test/t3/inizia/route.ts, components/test/TestPlayer.tsx, il banco (giocaTest)
grant insert (student_id, test_slug) on public.test_attempt to authenticated;
grant update (item_corrente, updated_at) on public.test_attempt to authenticated;
-- test_response: components/test/TestPlayer.tsx, app/api/test/t3/inizia/route.ts, il banco (giocaTest): upsert
grant insert (attempt_id, item_id, payload) on public.test_response to authenticated;
grant update (attempt_id, item_id, payload) on public.test_response to authenticated;
-- workshop_elaborati: components/workshop/elaborato/ElaboratoEditor.tsx, il banco (gioca): upsert
grant insert (iscrizione_id, contenuto, updated_at) on public.workshop_elaborati to authenticated;
grant update (iscrizione_id, contenuto, updated_at) on public.workshop_elaborati to authenticated;
-- workshop_iscrizioni: components/workshop/IscrizioneRuolo.tsx, il banco (gioca)
grant insert (workshop_id, student_id, ruolo_id) on public.workshop_iscrizioni to authenticated;
-- workshop_messaggi: components/workshop/NetworkPeers.tsx (l'invio passa da invia_messaggio_rete_workshop, definer)
grant update (letto) on public.workshop_messaggi to authenticated;
-- workshop_tutor_log: app/api/workshop/tutor/route.ts (il tetto, scritto prima della chiamata)
grant insert (iscrizione_id, sezione_id, modo) on public.workshop_tutor_log to authenticated;

-- ── la rilettura ─────────────────────────────────────────────────────────────
do $$
declare
  v_colonne integer;
  v_tabelle text;
  v_predefiniti text;
begin
  -- Nessuna concessione di tabella intera al client.
  select string_agg(c.relname, ', ') into v_tabelle
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE'));
  if v_tabelle is not null then
    raise exception 'tabelle ancora scrivibili per intero dal client: %', v_tabelle;
  end if;

  -- Le colonne scrivibili sono esattamente quelle del registro (199 il 28/10).
  select count(*) into v_colonne
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  cross join (values ('anon'), ('authenticated')) r(ruolo)
  cross join (values ('INSERT'), ('UPDATE')) p(priv)
  where n.nspname = 'public' and c.relkind = 'r'
    and has_column_privilege(r.ruolo, c.oid, a.attname, p.priv);
  if v_colonne <> 199 then
    raise exception 'colonne scrivibili dal client: %, ne erano dichiarate 199 (supabase/colonne-del-client.json)', v_colonne;
  end if;

  -- I privilegi predefiniti di chi esegue (cioè di chi crea le nostre tabelle) non
  -- concedono più insert e update al client: né in `public`, né in `storage`, né
  -- nella riga senza schema, che vale per tutti. Il messaggio NOMINA LO SCHEMA:
  -- il 28/10 non lo nominava, e due righe identiche in due schemi diversi si
  -- leggevano come una sola. Le righe di `supabase_admin` restano fuori di
  -- proposito: valgono per gli oggetti che crea Supabase, non per i nostri.
  select string_agg(coalesce(n.nspname, '(tutti gli schemi)') || ': ' || x::text, ', ' order by n.nspname, x::text)
    into v_predefiniti
  from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace, unnest(d.defaclacl) x
  where d.defaclrole = current_user::regrole and d.defaclobjtype = 'r'
    and (d.defaclnamespace = 0 or n.nspname in ('public', 'storage'))
    and (x::text like 'anon=%' or x::text like 'authenticated=%')
    and split_part(split_part(x::text, '=', 2), '/', 1) ~ '[aw]';
  if v_predefiniti is not null then
    raise exception 'i privilegi predefiniti concedono ancora insert o update al client: %', v_predefiniti;
  end if;
end $$;
