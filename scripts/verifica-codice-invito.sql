-- IL CODICE D'INVITO DEL TUTOR E IL TETTO AI TENTATIVI (20261201100000 e 110000).
--
-- Le proprietà:
--   1-2  il codice lo scrive solo crea_invito_tutor, ed è lungo;
--   3-6  la verifica senza account passa solo dal server e conta per rete;
--   7-9  il riscatto conta per account e non solleva sul codice sbagliato;
--   10-11 i tentativi non li legge nessuno, e invecchiano;
--   12   le due porte di prima non ci sono più.
--
-- CONTROPROVA: su una replica nata senza le due migrazioni sono rosse tutte
-- tranne la 8: le funzioni nuove non esistono, la 1 riesce (il referente sceglie
-- il codice) e la 12 trova le due porte di prima. La 8 è verde anche lì, perché
-- nel mondo di prima nessuno prova nemmeno a prendere l'invito.
--
-- Transazione con ROLLBACK.

begin;
set local role postgres;

create temp table esiti (n int, cosa text, atteso text, trovato text, ok boolean) on commit drop;
grant all on esiti to authenticated;

insert into auth.users (id, email) values
 ('77777777-0000-0000-0000-0000000000b1', 'ref-inv@test.it'),
 ('77777777-0000-0000-0000-0000000000b2', 'tentatore-inv@test.it'),
 ('77777777-0000-0000-0000-0000000000b3', 'tutor-inv@test.it');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita) values
 ('77777777-0000-0000-0000-0000000000b1', 'referente_scuola', 'R', 'I', '1980-01-01');
insert into public.scuole_profili (id, scuola_id, stato)
 select 'bbbbbbbb-0000-0000-0000-0000000000b1', codice_meccanografico, 'attiva' from public.schools limit 1;
insert into public.school_staff (id, user_id, scuola_profilo_id, ruolo_staff, attivo, creato_da) values
 ('cccccccc-0000-0000-0000-0000000000b1', '77777777-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'referente', true, '77777777-0000-0000-0000-0000000000b1');

create temp table invito (codice text) on commit drop;
grant all on invito to authenticated;

-- 1 · il referente non scrive una riga di staff dal client (e quindi non sceglie il codice).
do $$ declare r text := 'riuscito'; begin
  perform set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  begin
    insert into public.school_staff (scuola_profilo_id, ruolo_staff, codice_invito, nome_invitato, email_invitato, creato_da)
    values ('bbbbbbbb-0000-0000-0000-0000000000b1', 'tutor', 'TUTOR-SCELTO', 'N', 'n@x.it', '77777777-0000-0000-0000-0000000000b1');
  exception when others then r := sqlstate;
  end;
  reset role;
  insert into esiti values (1, 'il referente non inserisce una riga di staff dal client', '42501', r, r = '42501');
end $$;

-- 2 · crea_invito_tutor lo fa, con un codice lungo, scritto da lei.
do $$ declare r text := 'riuscito'; c text; begin
  perform set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  begin
    c := public.crea_invito_tutor('Anna', 'anna@x.it');
    insert into invito values (c);
  exception when others then r := sqlstate;
  end;
  reset role;
  insert into esiti values (2, 'crea_invito_tutor scrive un codice di 64 bit, in quattro gruppi', 'TUTOR-XXXX-XXXX-XXXX-XXXX',
    coalesce(c, r), coalesce(c ~ '^TUTOR-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', false));
end $$;

-- 3 · la verifica non la chiama il client, né senza account né con.
insert into esiti
select 3, 'controlla_codice_invito la esegue solo il server', 'falso, falso',
  a::text || ', ' || b::text, not a and not b
from (select
  coalesce(has_function_privilege('anon', to_regprocedure('public.controlla_codice_invito(text, text)'), 'execute'), true) a,
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.controlla_codice_invito(text, text)'), 'execute'), true) b) x;

-- 4 · il codice giusto è valido, e dice la scuola.
do $$ declare r jsonb; e text := ''; begin
  begin
    r := public.controlla_codice_invito((select codice from invito), repeat('a', 64));
  exception when others then e := sqlstate;
  end;
  insert into esiti values (4, 'il codice giusto è valido', 'valido', coalesce(r ->> 'esito', e), r ->> 'esito' = 'valido');
end $$;

-- 5 · dieci codici sbagliati dalla stessa rete, e l'undicesimo (anche giusto) è fermo.
do $$ declare r jsonb; e text := ''; i int; begin
  begin
    for i in 1..10 loop perform public.controlla_codice_invito('TUTOR-0000-0000-0000-000' || i % 10, repeat('b', 64)); end loop;
    r := public.controlla_codice_invito((select codice from invito), repeat('b', 64));
  exception when others then e := sqlstate;
  end;
  insert into esiti values (5, 'dopo dieci codici sbagliati in un''ora la stessa rete è ferma, anche col codice giusto', 'troppi_tentativi',
    coalesce(r ->> 'esito', e), r ->> 'esito' = 'troppi_tentativi');
end $$;

-- 6 · …e un'altra rete no.
do $$ declare r jsonb; e text := ''; begin
  begin
    r := public.controlla_codice_invito((select codice from invito), repeat('c', 64));
  exception when others then e := sqlstate;
  end;
  insert into esiti values (6, 'un''altra rete non eredita il tetto', 'valido', coalesce(r ->> 'esito', e), r ->> 'esito' = 'valido');
end $$;

-- 7 · il riscatto conta per account: cinque sbagliati rispondono, il sesto è fermo.
do $$ declare r jsonb; e text := ''; i int; primi text := ''; begin
  perform set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-0000000000b2', true);
  set local role authenticated;
  begin
    for i in 1..5 loop
      r := public.riscatta_invito_tutor('TUTOR-1111-1111-1111-111' || i, 'T', 'X');
      primi := primi || (r ->> 'esito') || ' ';
    end loop;
    r := public.riscatta_invito_tutor((select codice from invito), 'T', 'X');
  exception when others then e := sqlstate;
  end;
  reset role;
  insert into esiti values (7, 'il codice sbagliato risponde (non solleva), e dopo cinque l''account è fermo anche col codice giusto',
    'codice_non_valido ×5, poi troppi_tentativi', trim(primi) || ' → ' || coalesce(r ->> 'esito', e),
    primi = repeat('codice_non_valido ', 5) and r ->> 'esito' = 'troppi_tentativi');
end $$;

-- 8 · …e l'invito è ancora libero: il tentatore non è diventato tutor.
-- (Una riga sempre, anche senza invito: una prova che sparisce dall'uscita è
-- contata verde, il modo 2-ter.)
insert into esiti
select 8, 'l''account fermato non ha preso l''invito', 'nessuno, e l''invito c''è',
  case when ss.id is null then 'nessun invito' else coalesce(ss.user_id::text, 'nessuno') end,
  ss.id is not null and ss.user_id is null
from (select 1) uno
left join public.school_staff ss on ss.codice_invito = (select codice from invito);

-- 9 · un altro account, con il codice giusto, riscatta.
do $$ declare r jsonb; e text := ''; begin
  perform set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-0000000000b3', true);
  set local role authenticated;
  begin
    r := public.riscatta_invito_tutor((select codice from invito), 'Anna', 'Tutor');
  exception when others then e := sqlstate;
  end;
  reset role;
  insert into esiti values (9, 'il codice giusto riscatta l''invito e crea il tutor', 'riscattato · tutor_scuola · legato',
    coalesce(r ->> 'esito', e) || ' · ' || coalesce((select ruolo::text from public.profiles where id = '77777777-0000-0000-0000-0000000000b3'), 'nessun profilo')
      || ' · ' || case when exists (select 1 from public.school_staff where codice_invito = (select codice from invito) and user_id = '77777777-0000-0000-0000-0000000000b3') then 'legato' else 'non legato' end,
    r ->> 'esito' = 'riscattato'
      and exists (select 1 from public.profiles where id = '77777777-0000-0000-0000-0000000000b3' and ruolo = 'tutor_scuola')
      and exists (select 1 from public.school_staff where codice_invito = (select codice from invito) and user_id = '77777777-0000-0000-0000-0000000000b3'));
end $$;

-- 10 · i tentativi non li legge il client, e il riscatto non lo chiama chi non ha un account.
insert into esiti
select 10, 'i tentativi non si leggono dal client, e il riscatto non lo chiama un visitatore', 'falso, falso',
  a::text || ', ' || b::text, not a and not b
from (select
  coalesce(has_table_privilege('authenticated', to_regclass('public.tentativi_codice_invito'), 'SELECT'), true) a,
  coalesce(has_function_privilege('anon', to_regprocedure('public.riscatta_invito_tutor(text, text, text)'), 'execute'), true) b) x;

-- 11 · una riga di più di un giorno si pota alla chiamata dopo.
do $$ declare n int; e text := ''; begin
  begin
    insert into public.tentativi_codice_invito (chiave, riuscito, created_at) values ('rete:vecchia', false, now() - interval '2 days');
    perform public.controlla_codice_invito('TUTOR-2222-2222-2222-2222', repeat('d', 64));
    select count(*) into n from public.tentativi_codice_invito where chiave = 'rete:vecchia';
  exception when others then e := sqlstate;
  end;
  insert into esiti values (11, 'i tentativi più vecchi di un giorno si potano', '0', coalesce(nullif(e, ''), n::text), e = '' and n = 0);
end $$;

-- 12 · le due porte di prima non ci sono più.
insert into esiti
select 12, 'verifica_invito_tutor e redeem_invito_staff sono uscite', 'nessuna',
  coalesce(nullif(concat_ws(', ',
    case when to_regprocedure('public.verifica_invito_tutor(text)') is not null then 'verifica_invito_tutor' end,
    case when to_regprocedure('public.redeem_invito_staff(text, text, text)') is not null then 'redeem_invito_staff' end), ''), 'nessuna'),
  to_regprocedure('public.verifica_invito_tutor(text)') is null and to_regprocedure('public.redeem_invito_staff(text, text, text)') is null;

select n, cosa, atteso, trovato, case when ok then '✓' else '✗ ROTTA' end as esito from esiti order by n;
select count(*) filter (where not ok) || ' ROTTE su ' || count(*) as riassunto from esiti;

rollback;
