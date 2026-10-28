-- I CONSENSI DATI DA CHI NON ERA MAGGIORENNE (sola lettura, si incolla nel SQL
-- Editor dopo 20261107110000).
--
-- Da 20261107110000 un sì vale solo se dato da maggiorenni
-- (consenso_dato_da_maggiorenne): al compimento dei 18 anni si chiede, non si
-- eredita. Le righe scritte prima NON sono state toccate: questa query dice
-- quante sono, e la decisione su cosa farne è di Mario.

-- 1) Comunicazioni di KIREO: i sì e se valgono, su TUTTI i profili che hanno
-- risposto, divisi per il ruolo che hanno OGGI.
--
-- ⚠️ Fino al 28/10 qui c'era `where p.ruolo = 'studente'`, e contava 5 sì dove la
-- colonna ne ha 6 (Mario): il sesto ha dato il consenso da studente, alla
-- registrazione, e oggi è admin. *Un filtro su un ruolo che cambia nel tempo non
-- seleziona chi ha agito: seleziona chi è adesso.* Il consenso è un gesto fermo
-- nel passato, quindi qui non si filtra sul ruolo: si mostra, e la colonna dice
-- che è il ruolo di oggi.
select p.di_prova,
       p.ruolo as ruolo_di_oggi,
       count(*) filter (where p.comunicazioni_kireo) as si,
       count(*) filter (where p.comunicazioni_kireo
                        and public.consenso_dato_da_maggiorenne(p.comunicazioni_kireo_il, p.data_nascita)) as si_validi,
       count(*) filter (where p.comunicazioni_kireo
                        and not public.consenso_dato_da_maggiorenne(p.comunicazioni_kireo_il, p.data_nascita)) as si_da_minorenne_o_senza_data
  from public.profiles p
 where p.comunicazioni_kireo is not null
 group by p.di_prova, p.ruolo order by p.di_prova, p.ruolo;

-- 2) Newsletter degli enti: le iscrizioni e se valgono.
select p.di_prova,
       count(*) as iscrizioni,
       count(*) filter (where public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)) as valide,
       count(*) filter (where not public.consenso_dato_da_maggiorenne(n.created_at, p.data_nascita)) as da_minorenne_o_senza_data
  from public.newsletter_iscrizioni n
  join public.profiles p on p.id = n.student_id
 group by p.di_prova order by p.di_prova;
