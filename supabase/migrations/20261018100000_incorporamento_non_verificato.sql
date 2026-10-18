-- «NON LO SO» È UNA RISPOSTA AMMESSA SULL'INCORPORAMENTO (Mario, montando la
-- diretta del 18/10).
--
-- IL DIFETTO. Quando la sonda non può misurare (`non_controllato`, tipicamente
-- una finestra in incognito o un blocco degli script di terze parti), il form
-- chiedeva all'ente di spuntare «l'incorporamento è attivo», e la spunta era
-- OBBLIGATORIA. Mario ha controllato, ha trovato che non lo era, e non poteva
-- salvare senza dichiarare il falso: la riga salvata conteneva una
-- dichiarazione che al momento della firma era falsa. Un modulo che non lascia
-- proseguire finché non dichiari una cosa che non sai non raccoglie una
-- dichiarazione: la fabbrica.
--
-- E L'ASIMMETRIA ERA NOSTRA: alla sonda era concesso dire «non ho guardato»,
-- alla persona no — e proprio nel punto in cui nessuno sa la risposta.
--
-- LA CURA: una seconda chiave possibile nel jsonb, `incorporamento_non_verificato`,
-- che registra «non lo so» COME TALE. Il vincolo resta quello del 4/10 — la
-- domanda deve avere UNA risposta — ma adesso le risposte ammesse sono tre:
-- la misura, la dichiarazione positiva, la dichiarazione di non sapere.
--
-- ⚠️ COSA NON GARANTISCE, e va saputo: un evento salvato con
-- `incorporamento_non_verificato` può avere il video non incorporabile. La
-- rete è sulla pagina della diretta (`presenzaDaContare` smette di contare se
-- il player risponde 101/150) e nel campo dell'admin, che rifà la prova. Ma
-- rispetto a prima non si perde niente: prima la stessa riga diceva «attivo»
-- ed era falsa, adesso dice «non verificato» ed è vera.
--
-- ⚠️ VA APPLICATA PRIMA DEL DEPLOY: il form nuovo può scrivere la chiave
-- nuova, e con il vincolo vecchio quell'insert verrebbe rifiutato.
--
-- Il corpo del vincolo è quello di `20261004100000` (coalesce compreso, che
-- chiude il buco del NULL), con una riga in più.

alter table public.eventi
  drop constraint if exists eventi_diretta_proprio_coerente;

alter table public.eventi
  add constraint eventi_diretta_proprio_coerente check (
    hosting_diretta = 'kireo'
    or coalesce(
      youtube_video_id is not null
      and checklist_diretta_accettata_il is not null
      and checklist_diretta ? 'non_in_elenco'
      and checklist_diretta ? 'chat_disattivata'
      and checklist_diretta ? 'no_contenuti_terzi'
      and (
        checklist_diretta ? 'incorporamento_attivo'
        or checklist_diretta ? 'incorporamento_non_verificato'
        or incorporamento_sonda = 'attivo'
      ),
      false
    )
  );

comment on column public.eventi.checklist_diretta is
  'Per voce, il timestamp in cui l''ente l''ha confermata. Sull''incorporamento, SOLO quando la sonda non ha potuto misurarlo (vedi incorporamento_sonda), c''è una delle due chiavi: `incorporamento_attivo` (l''ente dichiara di averlo controllato e che è attivo) oppure `incorporamento_non_verificato` (l''ente dichiara di non saperlo). Dove la misura c''è, nessuna delle due: registrarla sarebbe scrivere una dichiarazione che nessuno ha fatto.';
