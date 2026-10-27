-- IL SITO UFFICIALE DI UN ENTE HA SEMPRE UNO SCHEMA (Mario, 27/10).
--
-- IL CASO: nel profilo di Davante il campo conteneva `www.davante.it`. Dalla
-- pagina pubblica lo studente clicca «Sito ufficiale» e arriva al 404 di
-- kireo.it: un indirizzo senza `https://` non è un indirizzo assoluto, è un
-- percorso relativo, e il browser lo attacca al nostro dominio.
--
-- PERCHÉ ERA PASSATO, e sono due strade: il form del profilo (`ProfiloEnteForm`)
-- ha `type="url"` ma salva da un bottone fuori da un `<form>`, quindi il browser
-- mostra «Inserisci un URL» e non ferma niente; la registrazione dell'ente
-- (`RichiestaAccessoEnteForm`) ha `noValidate` e non controlla il campo. *Un
-- avviso che infastidisce chi lo legge e non ferma chi lo ignora.*
--
-- LA CURA STA SUL POSTO, non sulle strade: un trigger normalizza ogni scrittura
-- (manca lo schema → `https://`; vuoto → null), e un vincolo pretende lo
-- schema. Il vincolo è la guardia: se un giorno qualcuno toglie o scavalca il
-- trigger, o aggiunge una terza strada per salvare il profilo, la scrittura
-- senza schema fallisce a voce alta invece di produrre un altro 404.
--
-- ⚠️ IL VINCOLO NON GIUDICA L'INDIRIZZO, solo lo schema: «ciao come stai»
-- diventa `https://ciao come stai` e passa. Rifiutarlo farebbe fallire anche la
-- registrazione dell'ente, che salva il campo a conferma dell'email, quando
-- nessuno è davanti al form per leggere il rifiuto.
--
-- COME SI VERIFICA APPLICATA: il vincolo `istituzioni_sito_con_schema` esiste
-- in `pg_constraint` (lo crea solo questa migrazione), e
-- `select count(*) from public.istituzioni where sito_ufficiale !~* '^https?://'`
-- dà 0.

create or replace function public.normalizza_sito_ufficiale()
returns trigger
language plpgsql
as $$
begin
  if new.sito_ufficiale is not null then
    new.sito_ufficiale := btrim(new.sito_ufficiale);
    if new.sito_ufficiale = '' then
      new.sito_ufficiale := null;
    elsif new.sito_ufficiale !~* '^https?://' then
      -- «//davante.it» e «://davante.it» sono mezzi indirizzi: si toglie quello
      -- che c'è davanti al nome, poi si mette lo schema.
      new.sito_ufficiale := 'https://' || regexp_replace(new.sito_ufficiale, '^[a-z]*:?/+', '', 'i');
    end if;
  end if;
  return new;
end;
$$;

comment on function public.normalizza_sito_ufficiale() is
  '20261102100000: il sito ufficiale si salva sempre con uno schema (manca → https://, vuoto → null). La guardia è il vincolo istituzioni_sito_con_schema.';

drop trigger if exists normalizza_sito_ufficiale on public.istituzioni;
create trigger normalizza_sito_ufficiale
  before insert or update of sito_ufficiale on public.istituzioni
  for each row execute function public.normalizza_sito_ufficiale();

-- Le righe già salvate: poche, tutte di prova al 27/10. L'update passa dal
-- trigger appena creato, quindi la regola è una sola anche qui.
update public.istituzioni
set sito_ufficiale = sito_ufficiale
where sito_ufficiale is not null and sito_ufficiale !~* '^https?://';

alter table public.istituzioni
  add constraint istituzioni_sito_con_schema
  check (sito_ufficiale is null or sito_ufficiale ~* '^https?://');
