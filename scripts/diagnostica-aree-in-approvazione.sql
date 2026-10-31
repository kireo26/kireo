-- QUANTE AREE SONO FERME IN «IN APPROVAZIONE», E DI CHI (31/10). Sola lettura,
-- un'istruzione sola, nel SQL Editor così com'è. Da lanciare PRIMA di
-- 20261123120000: se ci sono enti veri con aree ferme da settimane, prima della
-- migrazione c'è un'email di Mario.
--
-- `di_prova` è del profilo di chi ha registrato l'ente: un ente vero è uno i cui
-- account non sono tutti di prova.
select i.nome as ente, i.stato as stato_ente, ia.area_slug, ia.created_at as chiesta_il,
       now()::date - ia.created_at::date as giorni_ferma,
       case when count(ip.user_id) = 0 then null else bool_and(coalesce(p.di_prova, false)) end as tutti_account_di_prova,
       count(ip.user_id) as account
from public.istituzioni_aree ia
join public.istituzioni i on i.id = ia.istituzione_id
left join public.institution_profiles ip on ip.istituzione_id = i.id
left join public.profiles p on p.id = ip.user_id
where ia.stato = 'in_approvazione'
group by i.nome, i.stato, ia.area_slug, ia.created_at
order by ia.created_at;
