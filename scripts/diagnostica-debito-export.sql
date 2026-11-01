-- IL DEBITO DI «SCARICA I MIEI DATI», IN RIGHE (01/11, sola lettura, un'istruzione).
--
-- Le 33 tabelle di ATTESE (lib/app/esportaDati.ts): quelle che il file dei dati
-- dichiara di NON contenere ancora. Il tetto (npm run test:export §9) conta le
-- tabelle; questa query dice quanto pesa ognuna, in righe, in produzione. Da qui
-- non si vedono: la replica è vuota.
--
-- Generata da ATTESE il 01/11: se ATTESE cambia, questa query invecchia
-- (una tabella uscita dal debito resta qui, una nuova manca). Non è una guardia.
select tabella, natura, righe
from (
  select 'consegne_evento' as tabella, 'scritto' as natura, (select count(*) from public.consegne_evento) as righe
  union all
  select 'domande_live' as tabella, 'scritto' as natura, (select count(*) from public.domande_live) as righe
  union all
  select 'workshop_elaborati' as tabella, 'scritto' as natura, (select count(*) from public.workshop_elaborati) as righe
  union all
  select 'step_response' as tabella, 'scritto' as natura, (select count(*) from public.step_response) as righe
  union all
  select 'test_response' as tabella, 'scritto' as natura, (select count(*) from public.test_response) as righe
  union all
  select 'journal_entry' as tabella, 'scritto' as natura, (select count(*) from public.journal_entry) as righe
  union all
  select 'portfolio_item' as tabella, 'scritto' as natura, (select count(*) from public.portfolio_item) as righe
  union all
  select 'workshop_consegne' as tabella, 'scritto' as natura, (select count(*) from public.workshop_consegne) as righe
  union all
  select 'workshop_chat_cliente' as tabella, 'scritto' as natura, (select count(*) from public.workshop_chat_cliente) as righe
  union all
  select 'activity_log' as tabella, 'fatto' as natura, (select count(*) from public.activity_log) as righe
  union all
  select 'iscrizioni_eventi' as tabella, 'fatto' as natura, (select count(*) from public.iscrizioni_eventi) as righe
  union all
  select 'presenze_live' as tabella, 'fatto' as natura, (select count(*) from public.presenze_live) as righe
  union all
  select 'player_live_stato' as tabella, 'fatto' as natura, (select count(*) from public.player_live_stato) as righe
  union all
  select 'seguiti' as tabella, 'fatto' as natura, (select count(*) from public.seguiti) as righe
  union all
  select 'manifestazioni_interesse' as tabella, 'fatto' as natura, (select count(*) from public.manifestazioni_interesse) as righe
  union all
  select 'assistente_conversazioni' as tabella, 'fatto' as natura, (select count(*) from public.assistente_conversazioni) as righe
  union all
  select 'assistente_richieste' as tabella, 'fatto' as natura, (select count(*) from public.assistente_richieste) as righe
  union all
  select 'workshop_iscrizioni' as tabella, 'fatto' as natura, (select count(*) from public.workshop_iscrizioni) as righe
  union all
  select 'test_attempt' as tabella, 'fatto' as natura, (select count(*) from public.test_attempt) as righe
  union all
  select 'mission_attempt' as tabella, 'fatto' as natura, (select count(*) from public.mission_attempt) as righe
  union all
  select 'recinto_enti' as tabella, 'fatto' as natura, (select count(*) from public.recinto_enti) as righe
  union all
  select 'newsletter_iscrizioni' as tabella, 'fatto' as natura, (select count(*) from public.newsletter_iscrizioni) as righe
  union all
  select 'workshop_tutor_log' as tabella, 'fatto' as natura, (select count(*) from public.workshop_tutor_log) as righe
  union all
  select 'evidence' as tabella, 'dedotto' as natura, (select count(*) from public.evidence) as righe
  union all
  select 'area_signal' as tabella, 'dedotto' as natura, (select count(*) from public.area_signal) as righe
  union all
  select 'style_signal' as tabella, 'dedotto' as natura, (select count(*) from public.style_signal) as righe
  union all
  select 'workshop_fasi_stato' as tabella, 'dedotto' as natura, (select count(*) from public.workshop_fasi_stato) as righe
  union all
  select 'conversazioni_enti' as tabella, 'terzo' as natura, (select count(*) from public.conversazioni_enti) as righe
  union all
  select 'messaggi_enti' as tabella, 'terzo' as natura, (select count(*) from public.messaggi_enti) as righe
  union all
  select 'workshop_messaggi' as tabella, 'terzo' as natura, (select count(*) from public.workshop_messaggi) as righe
  union all
  select 'messaggi_scuola_destinatari' as tabella, 'terzo' as natura, (select count(*) from public.messaggi_scuola_destinatari) as righe
  union all
  select 'classi_studenti' as tabella, 'terzo' as natura, (select count(*) from public.classi_studenti) as righe
  union all
  select 'notifiche_studenti' as tabella, 'nostro' as natura, (select count(*) from public.notifiche_studenti) as righe
) t
order by righe desc, tabella;
