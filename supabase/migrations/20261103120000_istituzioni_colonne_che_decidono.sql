-- LE COLONNE DI `istituzioni` CHE DECIDONO NON LE SCRIVE CHI NE BENEFICIA
-- (Mario, 27/10). Va nello STESSO LOTTO di 20261103110000, non dopo: da quella
-- migrazione `tipo` non descrive più l'ente, decide quante aree può dichiarare.
-- *Un permesso scrivibile da chi ne beneficia non è un permesso*, e «nessuna
-- schermata lo cambia» non protegge niente: `istituzioni_update_propria` non
-- limita le colonne, e una schermata non è l'unica strada verso l'API (è la
-- frase smontata con `ore_pcto`).
--
-- IL CENSIMENTO DELLE COLONNE, una per una (la domanda di `di_prova`, un piano
-- più in là: una colonna che decide e una che racconta non hanno gli stessi
-- permessi):
--   DESCRIVONO, e l'ente le scrive dal profilo: descrizione,
--     immagine_copertina_url, sito_ufficiale, provincia.
--   DICHIARA l'ente, ed è suo: regolamento_accettato_il (lo scrive alla
--     registrazione e da AccettaRegolamentoForm). ⚠️ Oggi l'ente può scriverci
--     qualunque data, anche cancellarla: è una sua dichiarazione, e nessuno la
--     legge per decidere altro che «hai accettato». Resta scrivibile.
--   DECIDONO, e da oggi il client non le scrive:
--     - tipo: decide il limite delle aree (20261103110000). Si dichiara alla
--       registrazione (dentro finalize_registration_istituzione, security
--       definer) e lo vede l'admin quando attiva l'ente (la coda di /admin
--       mostra il tipo). Dopo, cambiarlo è un gesto dell'admin, dal SQL Editor.
--     - nome e slug: il nome è quello che l'admin ha approvato attivando
--       l'ente, e lo slug è l'indirizzo pubblico. Un ente attivato come
--       «Accademia X» che si rinomina «Università di Bologna» userebbe la
--       nostra approvazione per un'altra cosa.
--     - id, created_at: nessuno ha ragione di scriverle.
--   DECIDONO, e restano scrivibili dal client SOLO PER L'ADMIN: stato,
--     piano_id, piano_attivato_il, piano_scade_il. L'admin le scrive dal
--     client (AttivaIstituzioneButton; `approva_richiesta_upgrade` NON è
--     security definer, quindi scrive il piano con i privilegi dell'admin
--     collegato). Toglierle ad `authenticated` accecherebbe l'admin: i
--     privilegi sono per ruolo, non per riga. Le difende il trigger
--     `blocca_autoescalation_istituzione`, che qui SMETTE DI ESSERE MUTO.
--
-- IL TRIGGER ERA UNA SCRITTURA MUTA: per un non admin rimetteva i valori di
-- prima e l'update «riusciva» senza aver fatto niente (il modo 11). Ora un non
-- admin che CAMBIA una di quelle colonne riceve un errore
-- (`colonna_riservata_admin`). Chi non le tocca non vede differenze: il
-- profilo dell'ente aggiorna solo le sue quattro colonne.
--
-- ⚠️ E NON ERA MUTO SOLO CON L'ENTE: guardava `current_ruolo()`, che da una
-- connessione senza sessione (il SQL Editor) è NULL. Quindi un cambio di stato
-- o di piano fatto da Mario dal SQL Editor veniva rimesso com'era, in silenzio
-- — la stessa trappola di `blocca_autoflag_di_prova` il 30/08. Ora una
-- connessione senza sessione passa.
--
-- E LA POLICY DI INSERT ESCE: `istituzioni_insert_self_signup` lasciava a
-- qualunque collegato creare un'istituzione `in_attesa` con il piano e il tipo
-- che voleva — e il piano sarebbe arrivato all'attivazione con lei. Nessun
-- codice la usa: l'istituzione la crea `finalize_registration_istituzione`,
-- che è security definer. Via la policy e via il privilegio.
--
-- ⚠️ UNA COLONNA NUOVA di `istituzioni` non è aggiornabile dal client finché
-- qualcuno non la aggiunge al `grant` qui sotto: il verso rumoroso, ed è
-- voluto. La domanda da fare quel giorno è quella del censimento sopra.
--
-- COME SI VERIFICA APPLICATA:
--   has_column_privilege('authenticated', 'public.istituzioni', 'tipo', 'UPDATE') → falso
--   has_column_privilege('authenticated', 'public.istituzioni', 'descrizione', 'UPDATE') → vero
--   has_table_privilege('authenticated', 'public.istituzioni', 'INSERT') → falso

revoke insert, update on public.istituzioni from anon, authenticated;
grant update (
  descrizione, immagine_copertina_url, sito_ufficiale, provincia,
  regolamento_accettato_il,
  stato, piano_id, piano_attivato_il, piano_scade_il
) on public.istituzioni to authenticated;

drop policy if exists istituzioni_insert_self_signup on public.istituzioni;

create or replace function public.blocca_autoescalation_istituzione()
returns trigger
language plpgsql
as $$
begin
  -- Il ramo affermativo è «chi può»: l'admin, o nessuna sessione (SQL Editor,
  -- service_role, migrazioni), come in `blocca_autoflag_di_prova`.
  if auth.uid() is not null and public.current_ruolo() is distinct from 'admin' and (
    new.stato is distinct from old.stato
    or new.piano_id is distinct from old.piano_id
    or new.piano_attivato_il is distinct from old.piano_attivato_il
    or new.piano_scade_il is distinct from old.piano_scade_il
  ) then
    raise exception 'colonna_riservata_admin'
      using hint = 'Stato e piano di un ente li cambia solo KIREO.';
  end if;
  return new;
end;
$$;

comment on function public.blocca_autoescalation_istituzione() is
  '20261103120000: un non admin che cambia stato o piano di un''istituzione riceve colonna_riservata_admin. Fino a oggi i valori si rimettevano in silenzio e l''update risultava riuscito.';
