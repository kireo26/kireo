-- LA COLONNA ESCE DALLA LETTURA DEL CLIENT (Mario, 27/10) — migrazione G2 di due.
--
-- Va applicata DOPO il deploy che porta l'elenco dell'ente, la coda dell'admin
-- e la pagina dell'evento a leggere la nota da `note_revisione_eventi`
-- (`20261101100000`): prima romperebbe quelle tre letture, che oggi nominano
-- la colonna nella `select`.
--
-- La forma è quella di `20261029100000` per l'update: `revoke select` sulla
-- tabella e `grant select` su tutte le altre colonne, con l'elenco scritto.
-- ⚠️ LA CONSEGUENZA, nel verso rumoroso: una colonna aggiunta a `eventi` dopo
-- oggi NON è leggibile dal client finché qualcuno non la aggiunge qui sotto (con
-- una migrazione nuova) — e chi la nomina in una `select` riceve un errore di
-- permesso, non un valore vuoto. E un `select *` su `eventi` dal client
-- fallisce per intero: al 27/10 non ce n'è nessuno [cercato in app/, lib/,
-- components/; le due viste su `eventi` girano come proprietario].
--
-- Nessuna riga cambia: si toglie un permesso. RLS invariata: chi vedeva una riga
-- la vede ancora, senza quella colonna.
--
-- COME SI VERIFICA APPLICATA:
--   has_column_privilege('authenticated','public.eventi','note_revisione','SELECT') → falso
--   has_column_privilege('anon','public.eventi','note_revisione','SELECT')          → falso
--   has_column_privilege('authenticated','public.eventi','titolo','SELECT')         → vero
-- (la colonna di controllo dice che non si è chiusa tutta la tabella).

revoke select on public.eventi from anon, authenticated;
grant select (id, titolo, descrizione, tipo, organizzatore_id, data_inizio, data_fine, sede, link, posti, ore_pcto, stato, created_at, updated_at, cta_esterna_url, cta_esterna_approvata, in_evidenza, in_evidenza_dal, pubblico, filone, hosting_diretta, youtube_video_id, checklist_diretta, checklist_diretta_accettata_il, proposta_incontro_id, domanda_consegna, incorporamento_sonda, diretta_chiusa_il, diretta_chiusa_da_tipo, diretta_chiusa_da_user, diretta_chiusa_presenti, diretta_chiusa_certificati, diretta_durata_minuti, ore_pcto_fissate_il, ore_pcto_fissate_da) on public.eventi to anon, authenticated;

comment on column public.eventi.note_revisione is
  'La nota di un admin KIREO a una decisione di revisione. Obbligatoria per rifiutare (lib/admin/rifiuto.ts). Il client non la legge dalla tabella (20261101110000): la leggono l''admin e l''organizzatore da note_revisione_eventi.';
