-- KIREO — i due cancelli del percorso: missioni dopo i test, workshop dopo
-- un'esperienza. La condizione vive QUI, in SQL, e il TypeScript la consuma.
--
-- PERCHÉ IN SQL, e non in `lib/percorso/stato.ts` che dichiara di essere la
-- fonte unica dell'avanzamento. Perché le iscrizioni si creano DAL CLIENT:
-- `components/workshop/IscrizioneRuolo.tsx` fa un `insert` diretto su
-- `workshop_iscrizioni`, `components/escape/IniziaMissione.tsx` lo stesso su
-- `mission_attempt`. Un controllo in pagina non è un cancello: è un consiglio
-- con un bottone in meno, e si aggira con una richiesta a mano. L'unico posto
-- che non si aggira è il `with check` di una policy — e una policy non può
-- importare TypeScript. Quindi la definizione scende di lingua: il predicato è
-- una funzione SQL, e il TypeScript la chiama via RPC invece di riscriverla.
--
-- I DUE CANCELLI (decisione di Mario, 2026-09-20):
--
--   · MISSIONI  — i tre test completati, OPPURE hai già un tentativo;
--   · WORKSHOP  — «Esperienza» (una missione completata o un workshop
--                 consegnato), OPPURE hai già un'iscrizione.
--
-- Guide e test restano LIBERI: sono esplorazione, e chiuderli allontanerebbe
-- chi è appena arrivato.
--
-- LA CLAUSOLA «OPPURE SEI GIÀ DENTRO» NON È UNA CORTESIA: è quello che rende
-- vera la non-retroattività. Senza, tre cose che il prodotto permette oggi si
-- romperebbero, e tutte e tre perché sono un INSERT e non sembrano tale:
--   · il CAMBIO RUOLO (`ritira_iscrizione_workshop` + un insert nuovo — la
--     strada aperta apposta il 2026-08-30): uno lascia un ruolo e non può più
--     prenderne un altro. È l'unico caso in cui un cancello toglierebbe una
--     cosa che uno aveva già;
--   · il RIGIOCO di una missione (`IniziaMissione` inserisce un tentativo
--     nuovo, non ne riapre uno vecchio);
--   · chi ha consegnato un workshop e mai giocato una missione, che per la
--     nostra stessa definizione di percorso è PIÙ avanti di chi la missione
--     l'ha fatta.
-- «Non retroattivo» sullo stato copre chi sta fermo; questa riga copre chi si
-- muove. Chi è già stato dentro una volta ha già dimostrato quello che il
-- cancello chiede: o quel giorno il cancello non c'era, o c'era e l'ha passato.
--
-- PERCHÉ QUATTRO FUNZIONI E NON QUATTRO `exists` scritti dentro le policy.
-- Perché la stessa domanda la fanno in due: la policy, per rifiutare; e la
-- PAGINA, per dire allo studente quale passo gli manca invece di mostrargli un
-- errore. Due `exists` copiati sono due definizioni che divergono al primo che
-- ne tocca una; una funzione è un nome solo, che la policy usa e il TypeScript
-- chiama via RPC.
--
-- E PERCHÉ SECURITY DEFINER, visto che leggono righe che lo studente può già
-- leggere da sé: per togliere una dipendenza nascosta. Da INVOKER il predicato
-- passa dalle policy di `test_attempt`/`mission_attempt`/`workshop_*`; se un
-- domani una di quelle si restringesse, il cancello comincerebbe a rispondere
-- «no» a chi il diritto ce l'ha — e si chiuderebbe in silenzio, con l'aria del
-- prodotto che funziona. Da DEFINER il predicato dipende solo da sé.
--
-- NON È PER LA RICORSIONE, e vale la pena scriverlo perché è la prima cosa
-- che viene in mente: due di queste funzioni leggono la stessa tabella su cui
-- gira la policy che le chiama, e sembrava il caso di `messaggi_scuola`
-- (luglio 2026, «infinite recursion detected in policy»). **Provato, e non
-- succede**: là la ricorsione era fra DUE policy che si richiamavano a
-- vicenda; qui la sottoquery passa dalla policy di SELECT, che non rimanda
-- indietro. Controprova fatta con l'`exists` inline e una riga da trovare:
-- l'insert passa, nessun 42P17. Se un domani qualcuno volesse togliere gli
-- helper, il motivo per cui restano è quello sopra, non questo.
--
-- ESPOSIZIONE: tutte e quattro rispondono SOLO su `auth.uid()`. Non accettano
-- un id, quindi non c'è nessuna domanda che si possa fare su un altro
-- studente. Sono di sola lettura: non rientrano nella classe pericolosa di
-- `npm run test:guardie` (definer che SCRIVONO), e non hanno nessun `if` —
-- quindi nessun confronto che con NULL possa non scattare. Per un chiamante
-- senza sessione `auth.uid()` è NULL, l'uguaglianza nella `where` non trova
-- righe, e la risposta è `false`: **fallisce chiuso**, che è la direzione
-- giusta per un cancello.
--
-- E I RUOLI SI NOMINANO. Una funzione nuova nello schema `public` nasce
-- eseguibile da `anon` e `authenticated` per i default privileges di Supabase,
-- e un `revoke … from public` NON li toglie [verificato sul DB live il 19/09].

-- ─────────────────────────────────────────── i tre test
create or replace function public.ha_completato_i_tre_test()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct test_slug) = 3
  from public.test_attempt
  where student_id = auth.uid()
    and stato = 'completata'
    and test_slug in ('da-dove-parti', 'come-ti-muovi', 'piu-a-fondo')
$$;

comment on function public.ha_completato_i_tre_test() is
  'Cancello delle missioni. Gli slug sono quelli di lib/test/config.ts: se un test cambia slug, questa funzione va con lui.';

-- ─────────────────────────────────────────── esperienza
-- Lo stesso metro di `lib/percorso/stato.ts`, condizione 4: «almeno una
-- missione completata O un workshop consegnato». Non una quarta definizione
-- inventata per il cancello — quella esisteva già, e riusarla è tutto il punto.
--
-- «Consegnato» ha due forme, come di là: una riga in `workshop_consegne` (il
-- percorso v1, upload) oppure un elaborato in stato 'consegnato' (il v2 a
-- tappe). Nessun filtro sullo stato dell'iscrizione: un'iscrizione lasciata
-- con dentro una consegna resta un workshop consegnato — è successo davvero.
create or replace function public.ha_esperienza_percorso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mission_attempt
    where student_id = auth.uid() and stato = 'completata'
  ) or exists (
    select 1
    from public.workshop_iscrizioni i
    join public.workshop_consegne c on c.iscrizione_id = i.id
    where i.student_id = auth.uid()
  ) or exists (
    select 1
    from public.workshop_iscrizioni i
    join public.workshop_elaborati e on e.iscrizione_id = i.id
    where i.student_id = auth.uid() and e.stato = 'consegnato'
  )
$$;

-- ─────────────────────────────────────────── «sei già dentro»
create or replace function public.e_gia_entrato_in_un_workshop()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workshop_iscrizioni where student_id = auth.uid())
$$;

create or replace function public.ha_gia_giocato_una_missione()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mission_attempt where student_id = auth.uid())
$$;

-- ─────────────────────────────────────────── i due cancelli
-- Le policy si ricreano per intero: le condizioni che c'erano restano parola
-- per parola, il cancello è l'ultima riga.
drop policy if exists mission_attempt_insert_own on public.mission_attempt;
create policy mission_attempt_insert_own on public.mission_attempt
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and (public.ha_completato_i_tre_test() or public.ha_gia_giocato_una_missione())
  );

drop policy if exists workshop_iscrizioni_insert_own on public.workshop_iscrizioni;
create policy workshop_iscrizioni_insert_own
  on public.workshop_iscrizioni for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and stato = 'attivo'
    and exists (select 1 from public.workshop w where w.id = workshop_id and w.attivo)
    and exists (select 1 from public.workshop_ruoli r where r.id = ruolo_id and r.workshop_id = workshop_id)
    and (public.ha_esperienza_percorso() or public.e_gia_entrato_in_un_workshop())
  );

-- ─────────────────────────────────────────── i ruoli, nominati
revoke all on function public.ha_completato_i_tre_test() from public, anon;
revoke all on function public.ha_esperienza_percorso() from public, anon;
revoke all on function public.e_gia_entrato_in_un_workshop() from public, anon;
revoke all on function public.ha_gia_giocato_una_missione() from public, anon;

grant execute on function public.ha_completato_i_tre_test() to authenticated;
grant execute on function public.ha_esperienza_percorso() to authenticated;
grant execute on function public.e_gia_entrato_in_un_workshop() to authenticated;
grant execute on function public.ha_gia_giocato_una_missione() to authenticated;
