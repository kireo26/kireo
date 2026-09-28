-- KIREO — quante volte si può far rileggere una consegna.
--
-- COSA C'ERA PRIMA: niente. `RileggiConsegna` aveva come solo limite il proprio
-- `disabled` durante l'invio, la route rigiudica su ogni `23505`, e
-- `puo_consegnare_evento` non conta i tentativi: l'unico tetto era la finestra di
-- 48 ore. Dentro quella finestra, con un revisore che fallisce davvero, premere
-- venti volte era possibile — e **ogni pressione è una chiamata a pagamento**.
-- Non è la bolletta il problema: è la stessa forma del tetto dei workshop. Una
-- porta che si può spingere all'infinito prima o poi la spinge qualcuno, e il
-- primo che lo scopre non sarà uno che voleva romperla: sarà uno che non vedeva
-- succedere niente e ha ripremuto.
--
-- PERCHÉ UN TETTO E NON UN INTERVALLO MINIMO: un intervallo rallenta e non
-- limita il totale. La cosa che non deve esistere è il caso in cui premere non
-- costa niente a chi preme e costa a noi ogni volta, e quella la chiude solo un
-- numero massimo.
--
-- IL CONTATORE SI ALZA PRIMA DELLA CHIAMATA, non dopo, ed è il pattern di casa
-- (`assistente_conversazioni`, `workshop_tutor_log`: la riga si scrive prima di
-- chiamare Anthropic, così un tentativo bloccato non paga una chiamata che
-- verrebbe comunque scartata). La DIREZIONE DELL'ERRORE è dichiarata: se la
-- route muore fra l'incremento e la chiamata, un tentativo è consumato senza che
-- una chiamata sia stata spesa. È il verso conservativo — incrementare dopo
-- lascerebbe passare tutte le richieste parallele, che è il caso per cui il tetto
-- esiste.
--
-- LA CORSA LA CHIUDE IL DATABASE, non un conteggio letto prima: l'`update` porta
-- la condizione sul tetto nella propria `where`, e Postgres la rivaluta sulla
-- versione nuova della riga dopo aver preso il lock — due pressioni simultanee al
-- confine non possono passare entrambe. È lo stesso principio dei fair-use già in
-- uso (`limite_eventi_in_approvazione`, `limite_conversazioni_assistente_giorno`):
-- un vincolo vero, non un controllo applicativo prima dell'insert.
--
-- UN MESTIERE SOLO: questa funzione LIMITA, e non decide se c'è qualcosa da
-- rileggere. «Già letta» la sa il ramo `23505` della route (che risponde 409) e
-- la pagina, che non mostra il bottone su una consegna valutata; metterla anche
-- qui sarebbe la seconda definizione della stessa cosa, e due definizioni
-- divergono. Chiamarla da fuori alza un contatore e non spende un centesimo: i
-- soldi li spende la route, e quel controllo la route ce l'ha.

alter table public.consegne_evento
  add column letture_tentate integer not null default 0;

comment on column public.consegne_evento.letture_tentate is
  'Quante volte si è tentato di leggere questa risposta: una per chiamata AI iniziata, la prima consegna compresa. Si alza solo da apri_lettura_consegna(), PRIMA della chiamata. Conta i tentativi, non le letture riuscite: un tentativo che fallisce a metà resta contato, ed è il verso giusto in cui sbagliare.';

-- ════════════════════════════════ il numero ════════════════════════════════
-- ⚠️ 5 È SCELTO, NON MISURATO: la prima consegna più quattro riletture. Nessuno
-- studente vero ha ancora premuto quel bottone, quindi non c'è nessun dato su
-- quante volte serva davvero — sta scritto qui perché nessuno lo ritrovi fra sei
-- mesi credendo che fosse tarato. La domanda che lo deciderebbe è quante
-- riletture servono perché una che sarebbe riuscita riesca, e la risposta la dà
-- il primo revisore che fallisce davvero in produzione.
--
-- Vive in una funzione e non come letterale dentro `apri_lettura_consegna` per la
-- stessa ragione di `tetto_iscrizioni_workshop()`: il numero è una cosa che si
-- discute, quindi sta in un posto che si può nominare. La copia in TypeScript
-- (`lib/eventi/rilettura.ts`) esiste perché la pagina deve decidere se mostrare
-- il bottone senza un giro di rete, e le due sono tenute ferme da
-- `npm run test:consegna-evento`, che estrae questo numero da qui e lo confronta
-- con quello: il database non può importare TypeScript, quindi la copia si chiude
-- con un controllo, come i tre slug dei test in `verifica-cancelli.js`.
create or replace function public.tetto_letture_consegna()
returns integer
language sql
immutable
as $$ select 5 $$;

comment on function public.tetto_letture_consegna() is
  'Quante letture al massimo può avere una consegna: la prima più le riletture. Numero scelto, non misurato. La copia in TypeScript serve alla pagina e la tiene ferma un test.';

-- Nessun chiamante fuori dal database: la legge solo apri_lettura_consegna (che
-- è definer e gira come proprietaria) e il test, che la legge come testo. Il
-- grant si dà a chi chiama, e qui non chiama nessuno.
revoke all on function public.tetto_letture_consegna() from public, anon, authenticated;

-- ═══════════════════════════════ il cancello ═══════════════════════════════
create or replace function public.apri_lettura_consegna(p_evento_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_letture integer;
begin
  -- `is null` e non un confronto: una sessione assente non deve poter alzare il
  -- contatore di nessuno, e un confronto con NULL non scatta.
  if v_student is null then
    raise exception 'non_autorizzato';
  end if;

  update public.consegne_evento
     set letture_tentate = letture_tentate + 1
   where evento_id = p_evento_id
     and student_id = v_student
     and letture_tentate < public.tetto_letture_consegna()
  returning letture_tentate into v_letture;

  if v_letture is null then
    -- Zero righe sono due no diversi, e vanno distinti perché il secondo ha un
    -- testo suo da dire a chi legge: il tetto è pieno, oppure quella consegna
    -- non è sua (o non esiste).
    if exists (
      select 1 from public.consegne_evento
       where evento_id = p_evento_id and student_id = v_student
    ) then
      raise exception 'troppe_letture';
    end if;
    raise exception 'non_autorizzato';
  end if;

  return v_letture;
end;
$$;

comment on function public.apri_lettura_consegna(uuid) is
  'Alza di uno il contatore delle letture della propria consegna e restituisce il nuovo valore, o solleva troppe_letture se il tetto è pieno. Va chiamata PRIMA della chiamata AI: è quella la cosa che limita. Non verifica se la consegna è già stata letta — quello lo sa la route.';

-- `revoke … from public, anon` e non solo `from public`: i default privileges di
-- Supabase concedono EXECUTE ad anon e authenticated su ogni funzione nuova dello
-- schema public, e una revoca da PUBLIC non li tocca (verificato sul DB live il
-- 19/09).
revoke all on function public.apri_lettura_consegna(uuid) from public, anon;
grant execute on function public.apri_lettura_consegna(uuid) to authenticated;
