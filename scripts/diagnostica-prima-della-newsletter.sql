-- Le misure prima del lotto della newsletter (30/10). Sola lettura: si lancia
-- nel SQL Editor così com'è, e il risultato è una tabella sola.
--
-- 1. Le quote dei piani come sono davvero nel database (non come le ricorda
--    una schermata), con il periodo su cui le conta il prodotto.
-- 2. Le due liste su cui nascerebbe un invio: devono essere ancora vuote, o
--    il primo invio raggiungerebbe persone iscritte quando non c'era niente
--    da ricevere.
-- 3. L'arretrato di `comunicazioni` di tipo newsletter, per stato: il motore
--    nuovo non deve raccoglierne nessuna.

select 'piano' as cosa, p.nome::text as chi,
       format('newsletter %s · eventi in evidenza %s · CTA esterne %s · comunicazioni KIREO %s (inutilizzata)',
              p.quota_newsletter, p.quota_eventi_promossi, p.quota_cta_esterne, p.quota_comunicazioni_kireo) as valore
  from public.piani p
union all
select 'periodo delle quote', 'tutti',
       'anno accademico, settembre → agosto (lib/ente/quote.ts, annoAccademicoCorrente)'
union all
select 'iscritti', 'newsletter_iscrizioni (newsletter degli enti)', count(*)::text
  from public.newsletter_iscrizioni
union all
select 'iscritti', 'newsletter_docenti (newsletter KIREO per i docenti)', count(*)::text
  from public.newsletter_docenti
union all
select 'arretrato', 'comunicazioni newsletter · ' || c.stato::text, count(*)::text
  from public.comunicazioni c
 where c.tipo = 'newsletter'
 group by c.stato
order by 1, 2;
