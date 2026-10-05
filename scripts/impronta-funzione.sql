-- L'IMPRONTA DI UNA FUNZIONE VIVA, IN FORMA CANONICA.
--
-- Si usa prima di un `create or replace` su una funzione che in produzione
-- potrebbe essere stata applicata a mano: dice se il codice vivo è lo stesso
-- del repo, e quindi se la sostituzione perde qualcosa.
--
-- ⚠️ PERCHÉ NON BASTA `md5(prosrc)`, e non è una rifinitura. Il 5/10 l'impronta
-- grezza del repo e quella della produzione divergevano, e la differenza era un
-- BLOCCO DI COMMENTI e nient'altro: quattro righe di solo commento, mangiate
-- insieme al loro newline da chi aveva applicato a mano. Il codice era identico
-- carattere per carattere.
--
--   corpo del repo (1514 car.)            → f8ecb7c9f7fc979166f93da392e34d38
--   lo stesso senza le 4 righe di commento → 656ab88cf04268cc07211b187bb6110b
--                                             ↑ ESATTAMENTE la produzione
--   forma canonica, da tutte e due         → c373ee1a6a89c5d1beaf92c63518a210
--
-- È LA QUARTA VOLTA CHE INCONTRIAMO QUESTA SPECIE: un controllo che legge il
-- SORGENTE di un testo legge anche la sua IMPAGINAZIONE. Prima volta a
-- settembre (il corpus delle pagine, dove un a-capo del formattatore rese rossa
-- un'àncora su una frase intatta: la cura fu `frasiDi`), poi due volte sui
-- controlli lessicali che trovavano la forma vietata dentro il commento che la
-- citava (la cura fu `senzaCommenti`/`senzaCommentiSql`, applicata AL LETTORE e
-- non alla singola asserzione). Qui la cura è la stessa, al lettore: si
-- confronta una forma canonica.
--
-- E LA RAGIONE PER CUI VALE LA PENA, nelle parole di Mario: «altrimenti ogni
-- volta si ferma tutto per un commento, e la terza volta nessuno si fermerà
-- più». Un controllo che grida su una cosa giusta è un controllo che qualcuno
-- disattiva — vale per un test e vale per una disciplina che esegue una persona.
--
-- LA FORMA CANONICA, e cosa NON tocca: via le righe di SOLO commento, via gli
-- spazi a fine riga, i vuoti multipli collassati, i bordi tagliati. NON tocca i
-- commenti a fine riga (`x := 1; -- nota`), perché lì il codice e la nota stanno
-- sulla stessa riga e separarli vorrebbe dire scrivere un parser; se una
-- divergenza canonica si riducesse a uno di quelli, si vede nel diff. NON
-- riformatta il codice: due corpi scritti con rientri diversi divergono ancora,
-- ed è giusto — quella è una differenza che un diff deve guardare.
--
-- ⚠️ L'IMPRONTA GREZZA RESTA, come segnale SECONDARIO: se le canoniche
-- coincidono e le grezze no, la differenza è nei commenti o nell'impaginazione —
-- cioè non è una divergenza di codice, ma è comunque una cosa che chi applica
-- deve sapere, perché il `create or replace` la sovrascrive. Nessuna delle due
-- sostituisce il diff quando le CANONICHE divergono.
--
-- ─────────────────────────── come si usa
-- Nel SQL Editor di Supabase: sostituire il nome qui sotto. Da psql:
--   psql -v nome=finalize_registration_istituzione -f scripts/impronta-funzione.sql
-- Sola lettura, nessuna transazione da annullare.

\if :{?nome}
\else
  \set nome 'finalize_registration_istituzione'
\endif

with corpi as (
  select
    p.oid,
    pg_get_function_identity_arguments(p.oid) as firma,
    p.prosecdef                               as e_definer,
    p.prosrc                                  as corpo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = :'nome'
),
canoniche as (
  select *,
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(corpo, '(?n)^[ \t]*--.*$', '', 'g'),  -- righe di solo commento
          '(?n)[ \t]+$', '', 'g'),                             -- spazi a fine riga
        '\n{2,}', chr(10), 'g')                                -- vuoti multipli collassati
    ) as canonica
  from corpi
)
select
  firma,
  case when e_definer then 'definer' else 'invoker' end as sicurezza,
  md5(canonica)                                         as impronta_canonica,
  md5(corpo)                                            as impronta_grezza,
  length(canonica)                                      as car_canonici,
  length(corpo)                                         as car_grezzi
from canoniche
order by firma;

-- QUANTI OVERLOAD: la riga che conta più delle impronte. Con più di uno, un
-- `create or replace` ne lascia uno vivo — è la trappola di `finalize_
-- registration` in Fase 2, dove un parametro aggiunto creò una seconda funzione
-- invece di sostituire la prima.
select count(*) as overload from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = :'nome';
