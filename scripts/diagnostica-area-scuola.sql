-- DIAGNOSTICA, sola lettura: cosa c'è oggi nell'area scuola (lotto 3, 01/11).
-- Un'istruzione sola, perché il SQL Editor mostra solo il risultato
-- dell'ultima. Risponde alle domande del brief che il codice non può dire:
-- quante scuole e in che stato, chi le usa, quanti studenti, se le classi e
-- i messaggi li usa qualcuno, se le ore «della scuola» sono mai partite.
-- Gli studenti di prova sono contati a parte (profiles.di_prova).
select
  (select string_agg(stato::text || ' ' || n, ' · ' order by stato)
     from (select stato, count(*) n from public.scuole_profili group by 1) x)          as scuole_per_stato,
  (select count(*) from public.school_staff where attivo and ruolo_staff = 'referente') as referenti_attivi,
  (select count(*) from public.school_staff where attivo and ruolo_staff = 'tutor')     as tutor_attivi,
  (select count(*) from public.school_staff where user_id is null)                       as inviti_non_riscattati,
  (select string_agg(stato_verifica::text || ' ' || n, ' · ' order by stato_verifica)
     from (select sp.stato_verifica, count(*) n from public.student_profiles sp
             join public.profiles p on p.id = sp.user_id and not p.di_prova
            where sp.school_code is not null or sp.stato_verifica = 'rifiutato'
            group by 1) x)                                                              as studenti_veri_per_stato,
  (select count(*) from public.student_profiles sp join public.profiles p on p.id = sp.user_id
    where p.di_prova and sp.school_code is not null)                                    as studenti_di_prova_con_scuola,
  (select count(*) from public.classi)                                                   as classi,
  (select count(*) from public.classi_studenti)                                          as studenti_in_classe,
  (select count(*) from public.messaggi_scuola)                                          as messaggi_scuola,
  (select count(*) from public.messaggi_scuola m
    where not exists (select 1 from public.messaggi_scuola_destinatari d where d.messaggio_id = m.id)) as messaggi_senza_destinatari,
  (select count(*) from public.messaggi_scuola_destinatari)                              as destinatari,
  (select count(*) from public.messaggi_scuola_destinatari where letto_il is not null)   as destinatari_che_hanno_letto,
  (select count(*) from public.iscrizioni_classe_eventi)                                 as iscrizioni_di_classe,
  (select count(*) from public.iscrizioni_eventi where origine = 'scuola')               as iscrizioni_fatte_dalla_scuola,
  (select count(*) from public.iscrizioni_eventi where certificata_da_tipo = 'scuola')   as presenze_certificate_dalla_scuola,
  (select count(*) from public.proposte_incontro)                                        as proposte_incontro;
-- (Le due colonne sulle ore «registrate dalla scuola» sono uscite il 01/11 con
-- le loro tabelle, 20261129100000.)
