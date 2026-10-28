-- I CONSENSI DATI DA CHI NON ERA MAGGIORENNE (sola lettura, si incolla nel SQL
-- Editor dopo 20261107110000).
--
-- Da 20261107110000 un sì vale solo se dato da maggiorenni
-- (consenso_dato_da_maggiorenne): al compimento dei 18 anni si chiede, non si
-- eredita. Le righe scritte prima NON sono state toccate: questa query dice
-- quante sono, e la decisione su cosa farne è di Mario.

-- 1) Comunicazioni di KIREO: i sì e se valgono.
select p.di_prova,
       count(*) filter (where p.comunicazioni_kireo) as si,
       count(*) filter (where p.comunicazioni_kireo
                        and public.consenso_dato_da_maggiorenne(p.comunicazioni_kireo_il, p.data_nascita)) as si_validi,
       count(*) filter (where p.comunicazioni_kireo
                        and not public.consenso_dato_da_maggiorenne(p.comunicazioni_kireo_il, p.data_nascita)) as si_da_minorenne_o_senza_data
  from public.profiles p
 where p.ruolo = 'studente'
 group by p.di_prova order by p.di_prova;

-- 2) Newsletter degli enti: le iscrizioni e se valgono.
select p.di_prova,
       count(*) as iscrizioni,
       count(*) filter (where public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)) as valide,
       count(*) filter (where not public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)) as da_minorenne_o_senza_data
  from public.newsletter_iscrizioni n
  join public.profiles p on p.id = n.student_id
 group by p.di_prova order by p.di_prova;
