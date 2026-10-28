-- LA COPIA DEL CONSENSO, RIGA PER RIGA (sola lettura, si incolla nel SQL Editor).
--
-- ⚠️ COME SI VERIFICA UNA COPIA (Mario, 28/10): riga per riga contro la
-- sorgente, MAI con un totale ricordato. Il 28/10 il controllo scritto per
-- 20261107100000 era «gli stessi 5 e 6 di ieri»; ha dato 6 e 5 più 5 «mai
-- chiesto», e per mezz'ora è sembrata un'inversione. Non lo era: la
-- diagnostica di ieri contava i metadati, compreso un utente senza profilo,
-- e la colonna vive in `profiles`; e un utente nuovo aveva detto sì quella
-- mattina. Due conteggi onesti su due insiemi diversi, confrontati come se
-- fossero lo stesso. Il confronto per riga risponde in un colpo, e dice anche
-- chi è la riga che non torna.
--
-- ⚠️ La chiave dei metadati si chiama `newsletter` e contiene il consenso alle
-- comunicazioni di KIREO, NON la newsletter di un ente (vedi
-- lib/finalizzaRegistrazione.ts).

-- 1) Ogni utente con la chiave, accanto alla sua riga di profilo.
--    esito = 'uguale' per ogni riga copiata; le altre righe dicono perché.
select u.email,
       u.created_at as registrato_il,
       u.raw_user_meta_data ->> 'newsletter' as metadato,
       p.comunicazioni_kireo as colonna,
       p.comunicazioni_kireo_il as colonna_il,
       case
         when p.id is null then 'senza profilo'
         when p.comunicazioni_kireo is null then 'mai chiesto nella colonna'
         when (u.raw_user_meta_data ->> 'newsletter')::boolean = p.comunicazioni_kireo then 'uguale'
         when p.comunicazioni_kireo_il > u.created_at + interval '1 minute' then 'cambiato dopo dal profilo'
         else 'DIVERSO'
       end as esito
  from auth.users u
  left join public.profiles p on p.id = u.id
 where u.raw_user_meta_data ? 'newsletter'
 order by esito, u.created_at;

-- 2) Il riassunto della stessa tabella: 'DIVERSO' deve essere 0.
select esito, count(*) from (
  select case
           when p.id is null then 'senza profilo'
           when p.comunicazioni_kireo is null then 'mai chiesto nella colonna'
           when (u.raw_user_meta_data ->> 'newsletter')::boolean = p.comunicazioni_kireo then 'uguale'
           when p.comunicazioni_kireo_il > u.created_at + interval '1 minute' then 'cambiato dopo dal profilo'
           else 'DIVERSO'
         end as esito
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.raw_user_meta_data ? 'newsletter'
) t group by esito order by esito;
