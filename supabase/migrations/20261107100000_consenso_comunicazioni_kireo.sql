-- IL CONSENSO ALLE COMUNICAZIONI DI KIREO, DA METADATO MAI LETTO A DATO VERO
-- (decisione di Mario, 28/10).
--
-- Fino a oggi la casella della registrazione («Voglio ricevere aggiornamenti
-- sulle attività di orientamento») finiva in auth.users.raw_user_meta_data
-- ->> 'newsletter', e nessun codice né funzione la leggeva. Era una domanda a
-- cui lo studente aveva risposto e che non produceva niente, mentre
-- /disiscrizione prometteva che le comunicazioni facoltative «le ricevi solo
-- se hai dato il consenso».
--
-- Da qui la casella è IL consenso alle comunicazioni di KIREO, e soltanto a
-- quelle: le newsletter degli enti hanno un'iscrizione loro, una per ente
-- (newsletter_iscrizioni). «Un consenso dedotto da un altro consenso non è un
-- consenso» (Mario): questa colonna non iscrive a niente, e niente la scrive
-- per conseguenza di un altro gesto.
--
-- TRE STATI, apposta: true (sì), false (no), NULL (non l'abbiamo mai chiesto:
-- gli account creati prima che la casella esistesse, o da una strada che non
-- la mostra — docenti, scuole, enti). NULL non vale come sì.
--
-- ⚠️ IL CONSENSO NON È UN PERMESSO DI INVIO. L'informativa (/privacy) dice che
-- le comunicazioni facoltative si mandano «solo previo consenso e solo agli
-- utenti maggiorenni»: il giorno in cui esisterà un invio, dovrà guardare
-- tutte e due le cose (questa colonna e is_maggiorenne). Un minorenne può
-- dire sì: il sì resta, l'invio aspetta.
--
-- CHI SCRIVE: solo imposta_comunicazioni_kireo (security definer), che mette
-- la data dal server. Il client non ha privilegi sulle due colonne (dal 28/10
-- una colonna nuova nasce non scrivibile: 20261106100000), e non li deve
-- avere: una data scritta dal client è una data scelta dal client.

alter table public.profiles
  add column comunicazioni_kireo boolean,
  add column comunicazioni_kireo_il timestamptz,
  add constraint profiles_comunicazioni_kireo_con_data
    check ((comunicazioni_kireo is null) = (comunicazioni_kireo_il is null));

comment on column public.profiles.comunicazioni_kireo is
  'Consenso alle comunicazioni facoltative di KIREO (non degli enti). NULL = mai chiesto, non vale come sì. Non è un permesso di invio: l''invio deve guardare anche is_maggiorenne. Lo scrive solo imposta_comunicazioni_kireo. 20261107100000.';

-- Le righe di oggi: la risposta data alla registrazione, con la data della
-- registrazione. Solo dove la risposta è un booleano vero e proprio; tutto il
-- resto resta NULL (mai chiesto).
update public.profiles p
   set comunicazioni_kireo = (u.raw_user_meta_data ->> 'newsletter')::boolean,
       comunicazioni_kireo_il = u.created_at
  from auth.users u
 where u.id = p.id
   and u.raw_user_meta_data ->> 'newsletter' in ('true', 'false');

create or replace function public.imposta_comunicazioni_kireo(p_consenso boolean, p_origine text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_righe int;
begin
  if v_uid is null then
    raise exception 'non_autenticato';
  end if;
  if p_consenso is null then
    raise exception 'consenso_mancante';
  end if;
  if p_origine not in ('registrazione', 'profilo', 'disiscrizione') then
    raise exception 'origine_non_valida';
  end if;

  -- Dalla registrazione si scrive solo se non c'è ancora una risposta: la
  -- conferma dell'email può arrivare due volte, e una scelta fatta dopo dal
  -- profilo non si sovrascrive con quella vecchia.
  if p_origine = 'registrazione' then
    update public.profiles
       set comunicazioni_kireo = p_consenso, comunicazioni_kireo_il = now()
     where id = v_uid and comunicazioni_kireo is null;
  else
    update public.profiles
       set comunicazioni_kireo = p_consenso, comunicazioni_kireo_il = now()
     where id = v_uid;
  end if;

  get diagnostics v_righe = row_count;
  if v_righe = 0 and p_origine <> 'registrazione' then
    raise exception 'profilo_non_trovato';
  end if;

  return (select comunicazioni_kireo from public.profiles where id = v_uid);
end;
$$;

revoke execute on function public.imposta_comunicazioni_kireo(boolean, text) from public, anon;
grant execute on function public.imposta_comunicazioni_kireo(boolean, text) to authenticated;

comment on function public.imposta_comunicazioni_kireo(boolean, text) is
  'Scrive il consenso alle comunicazioni di KIREO per chi chiama, con la data del server. Dalla registrazione solo se non c''è già una risposta. Restituisce il valore riletto. 20261107100000.';

-- La rilettura: le due colonne non devono essere scrivibili dal client.
do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'comunicazioni_kireo', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'comunicazioni_kireo', 'INSERT')
     or has_column_privilege('authenticated', 'public.profiles', 'comunicazioni_kireo_il', 'UPDATE') then
    raise exception 'il client può scrivere il consenso: non deve';
  end if;
end $$;
