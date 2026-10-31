-- LE AREE FERME IN «IN APPROVAZIONE» DIVENTANO APPROVATE (Mario, 31/10).
--
-- ⚠️ DA APPLICARE SOLO DOPO che Mario ha contato quante sono e di chi
-- (`scripts/diagnostica-aree-in-approvazione.sql`): se ce ne sono di enti veri,
-- ferme da settimane, prima di questa migrazione c'è un'email.
--
-- Quegli enti hanno chiesto, e sotto la regola nuova (20261123110000) quelle
-- aree le avrebbero: lasciarle in attesa sarebbe applicare a loro una regola
-- appena abolita. Lo stato `in_approvazione` resta nel tipo: è successo.
--
-- Il tetto (limite_aree_istituzione) scatta solo all'insert, e una riga in
-- approvazione contava già come attiva: il passaggio non porta nessun ente
-- sopra il suo massimo. La migrazione si ferma se ne resta una ferma.

do $$
declare
  v_prima integer;
  v_toccate integer;
begin
  select count(*) into v_prima from public.istituzioni_aree where stato = 'in_approvazione';
  update public.istituzioni_aree set stato = 'approvata' where stato = 'in_approvazione';
  get diagnostics v_toccate = row_count;
  if v_toccate <> v_prima then
    raise exception 'aree in approvazione: % contate, % portate ad approvata', v_prima, v_toccate;
  end if;
  if exists (select 1 from public.istituzioni_aree where stato = 'in_approvazione') then
    raise exception 'resta un''area in approvazione';
  end if;
  raise notice 'aree portate ad approvata: %', v_toccate;
end $$;
