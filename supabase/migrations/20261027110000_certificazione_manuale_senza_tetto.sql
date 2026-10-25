-- LA CERTIFICAZIONE MANUALE NON HA TETTO NÉ PAVIMENTO (decisione di Mario, 25/10).
--
-- Dal 26/10 `certifica_presenza` (la scuola che attesta una presenza) emetteva
-- `ore_riconoscibili_evento`, cioè le stesse regole della chiusura automatica:
-- mai più della durata vera, zero sotto i 20 minuti. Misurato: un incontro di 40
-- minuti dichiarato 3 ore → 0,67; di 15 minuti → 0.
--
-- LA RAGIONE PER CUI NON VALE QUI: il tetto e il minimo sono regole su ciò che
-- misuriamo NOI. Nella certificazione automatica KIREO è il testimone; in quella
-- manuale è il registro. Dove non abbiamo misurato niente non c'è niente da
-- limitare: una classe in DAD può aver seguito quaranta minuti di webinar e poi
-- due ore di lavoro in aula, e la scuola lo sa, noi no. Tagliarle le ore vorrebbe
-- dire sovrascrivere il giudizio di un docente con la nostra aritmetica, in
-- silenzio, su un documento che porta il suo nome. Un registro non corregge chi
-- dichiara: annota chi ha dichiarato — `certificata_da_tipo`/`_user`.
--
-- E CADONO TUTTI E DUE, non solo il tetto: lasciare il minimo darebbe un ibrido
-- che non difende niente (2 ore su 25 minuti sì, 1 ora su 15 minuti no). O vale
-- il giudizio della scuola o vale il nostro.
--
-- QUELLO CHE RESTA A LIMITARLA: le ore dichiarate per l'evento (`ore_pcto`). Una
-- scuola non inventa ore che l'evento non prevede.
--
-- NON TOCCA `ore_riconoscibili_evento`, che resta la regola della chiusura
-- automatica, né `certifica_partecipazione_docente`, che CONSERVA IL TETTO di
-- proposito (deciso il 25/10). La regola è una sola e non riguarda i ruoli:
-- CHI ATTESTA È INDIPENDENTE DALL'EVENTO? Una scuola che certifica i propri
-- studenti attesta un lavoro d'aula che noi non vediamo, e risponde ad altri di
-- quello che firma: lì il tetto cade. Un ente che certifica i partecipanti del
-- proprio evento è giudice e parte — può dichiarare tre ore, trasmetterne venti
-- minuti e attestarle a cinquanta docenti — quindi lì il tetto resta.
-- (Non perché le ore di un docente non finiscano su un documento: ci finiscono,
-- l'aggiornamento si attesta.)
-- ⚠️ LA CONDIZIONE CHE LA ROVESCIA: il giorno in cui a certificare un docente è
-- un TERZO (la sua scuola, un ordine professionale, l'ufficio scolastico), quel
-- caso segue la regola di questa funzione, non quella del tetto.
--
-- `create or replace`, firma invariata: i privilegi si conservano (revoke/grant
-- in coda per chi applica su un database senza quella del 26/10). Corpo ripreso
-- verbatim da 20261026100000 con UNA espressione cambiata. Nessun dato
-- trasformato: le certificazioni già emesse restano come sono.

create or replace function public.certifica_presenza(p_evento_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raggiungibile boolean;
  v_gia_certificato boolean;
  v_fusi text[];
  v_tipo_attivita public.tipo_attivita;
begin
  -- Delegabile al tutor via puo_certificare_presenze (vedi
  -- current_ha_permesso_staff in 20260715110000); il referente ha sempre
  -- tutto.
  if not public.current_ha_permesso_staff('certificazione_presenze') then
    raise exception 'non_autorizzato';
  end if;

  if not exists (
    select 1 from public.student_profiles sp
    where sp.user_id = p_student_id
      and sp.stato_verifica = 'verificato'
      and sp.school_code = public.current_scuola_id()
  ) then
    raise exception 'studente_non_verificato_o_scuola_diversa';
  end if;

  select exists (
    select 1 from public.iscrizioni_eventi ie
    where ie.evento_id = p_evento_id and ie.student_id = p_student_id and ie.origine = 'scuola'
    union all
    select 1
    from public.iscrizioni_classe_eventi ice
    join public.classi_studenti cs on cs.classe_id = ice.classe_id
    join public.classi c on c.id = ice.classe_id
    where ice.evento_id = p_evento_id
      and cs.student_id = p_student_id
      and c.scuola_profilo_id = public.current_scuola_profilo_id()
  ) into v_raggiungibile;

  if not v_raggiungibile then
    raise exception 'evento_non_raggiungibile_per_questa_scuola';
  end if;

  -- §C, lato scuola — e la domanda si fa PRIMA dell'upsert, perché qui, a
  -- differenza dell'altra funzione, una ri-certificazione dello STESSO evento è
  -- ammessa: se questo studente era già certificato, la riga di `activity_log`
  -- che esiste oggi può essere la sua, e non c'è niente da segnalare.
  select ie.certificata_da_tipo is not null into v_gia_certificato
  from public.iscrizioni_eventi ie
  where ie.evento_id = p_evento_id and ie.student_id = p_student_id;

  select (case e.tipo when 'workshop' then 'workshop_pcto' else 'partecipazione_webinar' end)::public.tipo_attivita
    into v_tipo_attivita
  from public.eventi e where e.id = p_evento_id;

  if v_gia_certificato is not true then
    select array_agg(format('%s:%s', p_student_id, ea.area_slug)) into v_fusi
    from public.eventi_aree ea
    where ea.evento_id = p_evento_id
      and exists (
        select 1 from public.activity_log al
        where al.student_id = p_student_id
          and al.area_slug = ea.area_slug
          and al.tipo_attivita = v_tipo_attivita
          and (al.created_at at time zone 'utc')::date = (now() at time zone 'utc')::date
      );
  end if;

  -- 27/10: le ore sono quelle DICHIARATE per l'evento, senza il tetto della
  -- durata vera né il minimo dei 20 minuti (vedi testa del file). 26/10: si
  -- emettono qui come nella chiusura. Una RI-certificazione
  -- di una riga già partecipata NON le riscrive: una certificazione emessa è un
  -- fatto (il valore resta quello del primo gesto).
  insert into public.iscrizioni_eventi (student_id, evento_id, stato, origine, certificata_da_tipo, certificata_da_user, certificata_il, ore_riconosciute)
  values (p_student_id, p_evento_id, 'partecipato', 'scuola', 'scuola', auth.uid(), now(), (select coalesce(e.ore_pcto, 0) from public.eventi e where e.id = p_evento_id))
  on conflict (student_id, evento_id) do update
  set stato = 'partecipato', certificata_da_tipo = 'scuola', certificata_da_user = auth.uid(), certificata_il = now(),
      ore_riconosciute = case when public.iscrizioni_eventi.stato = 'partecipato'
        then public.iscrizioni_eventi.ore_riconosciute else excluded.ore_riconosciute end;

  insert into public.activity_log (student_id, area_slug, tipo_attivita, peso)
  select
    p_student_id,
    ea.area_slug,
    v_tipo_attivita,
    (case e.tipo when 'workshop' then 25 else 15 end)
  from public.eventi e
  join public.eventi_aree ea on ea.evento_id = e.id
  where e.id = p_evento_id
  on conflict do nothing;

  if v_fusi is not null then
    begin
      perform public.registra_guasto(
        p_processo => 'scuola/certificazione',
        p_specie => 'credito_area_fuso',
        p_motivo => 'cap_giornaliero',
        p_dettaglio => format(
          'evento %s: il cap giornaliero di activity_log ha soppresso %s crediti d''area già presenti oggi per un altro evento — %s',
          p_evento_id, array_length(v_fusi, 1), array_to_string(v_fusi, ', ')
        ),
        p_di_prova => false
      );
    exception when others then
      raise warning 'allarme credito_area_fuso non registrato per %: %', p_evento_id, sqlerrm;
    end;
  end if;
end;
$$;
revoke all on function public.certifica_presenza(uuid, uuid) from public, anon;
grant execute on function public.certifica_presenza(uuid, uuid) to authenticated;

comment on function public.certifica_partecipazione_docente(uuid, uuid) is
  'Conserva il tetto di ore_riconoscibili_evento di proposito: qui attesta l''organizzatore stesso (giudice e parte). La certificazione della scuola (certifica_presenza) non ha tetto perché chi attesta è indipendente dall''evento. Se un giorno a certificare un docente sarà un terzo, quel caso segue la regola della scuola. Vedi 20261027110000.';
