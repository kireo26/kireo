-- LE «COMUNICAZIONI MIRATE» SONO USCITE, E `comunicazioni` NON SARÀ LA BASE
-- DELL'INVIO (28/10).
--
-- 1. La quota. «Comunicazione mirata» era una funzione del piano premium che non
--    esisteva: il form la proponeva, la quota la contava (5 l'anno), l'admin
--    l'approvava, e poi niente — nessun invio, nessun destinatario scritto da
--    nessuna parte. In produzione non ne è mai stata proposta una (misurato da
--    Mario il 28/10: 0 righe con tipo comunicazione_kireo). Dal 28/10 il form, i
--    riquadri, la pagina del piano e il listino non la nominano più. La colonna
--    resta (toglierla non serve a niente e rompe chi la legge ancora), ma
--    nessuno la legge: lo dice il commento, dove verrebbe in mente di usarla.
--
-- 2. La tabella. `comunicazioni` va in pensione come base della newsletter, e
--    non si riusa. Le ragioni, in ordine di peso:
--    - L'ARRETRATO. In produzione c'è una newsletter `approvata` del 18/10 che
--      nessuno ha mai mandato. Approvata vuol dire «un umano l'ha guardata con
--      le regole di allora», non «mandala». Il giorno in cui un motore leggesse
--      questa tabella, ogni `approvata` diventerebbe un ordine, e l'arretrato
--      partirebbe tutto insieme, a studenti che si sono iscritti dopo e con un
--      testo scritto per un altro momento. Un filtro sulla data scritto nel
--      motore sarebbe una regola su una strada; una tabella nuova, che nasce
--      con il motore, è una regola sul posto: niente di nato prima può essere
--      raccolto, perché prima la tabella non c'era.
--    - IL SIGNIFICATO DEGLI STATI. La newsletter nuova non ha approvazione
--      umana (decisione di Mario: margine prima della partenza, filtro
--      automatico, notifica all'admin). Riusare `approvata`/`in_approvazione`
--      vorrebbe dire dare a parole vecchie un significato nuovo, e chi legge le
--      righe di prima non saprebbe più quale dei due vale.
--    - LA PROMESSA ALL'ENTE. Le righe di oggi sono state scritte sotto «KIREO
--      la revisiona prima di veicolarla»: mandarle con un'altra regola sarebbe
--      cambiare il patto dopo la firma.
--    La regola, che vale oltre questa riga: L'INVIO NON LEGGE `comunicazioni`,
--    MAI. ⚠️ La guardia non c'è ancora perché il motore non c'è: il giorno in cui
--    si costruisce, nasce con una prova che diventa rossa se il suo codice
--    nomina questa tabella. E quel giorno il form dell'ente smette di scriverci:
--    fino ad allora le proposte restano qui, come oggi, e non partono.

comment on column public.piani.quota_comunicazioni_kireo is
  'INUTILIZZATA dal 28/10 (20261108100000): le «comunicazioni mirate» erano una funzione del piano che non esisteva, e sono uscite da form, quote, piano e listino. Nessun codice la legge. Non la si rimette in uso prima che esista un invio.';

comment on table public.comunicazioni is
  'Proposte di newsletter e (fino al 28/10) di «comunicazioni mirate» degli enti, con l''approvazione di KIREO. Nessuna è mai stata inviata. IN PENSIONE come base dell''invio (20261108100000): il motore della newsletter nasce su una tabella sua e NON legge questa, mai — uno stato «approvata» qui vuol dire «guardata con le regole di allora», non «mandala».';

do $$
begin
  if col_description('public.piani'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.piani'::regclass and attname = 'quota_comunicazioni_kireo'))
     not like '%20261108100000%' then
    raise exception 'il commento della colonna non è atterrato';
  end if;
  if obj_description('public.comunicazioni'::regclass, 'pg_class') not like '%20261108100000%' then
    raise exception 'il commento della tabella non è atterrato';
  end if;
end $$;
