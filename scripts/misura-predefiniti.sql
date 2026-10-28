-- LA MISURA DI MARIO PRIMA DI RIPROVARE 20261106100000 (28/10). NON CAMBIA NIENTE:
-- è un blocco solo che finisce sempre con un errore, e l'errore annulla tutto
-- (come è successo alla migrazione). Il messaggio dell'errore È la misura.
-- Un blocco solo, e non begin/select/rollback, perché il SQL Editor mostra il
-- risultato dell'ultima istruzione e un rollback non ne ha.
--
-- La domanda: l'`alter default privileges in schema … revoke` muove le righe
-- di `postgres`? La replica non sa rispondere (in produzione i predefiniti li
-- ha scritti Supabase, nello shim li scriviamo noi): si guarda qui.
--
-- Cosa ci si aspetta:
--   PRIMA  postgres/public e postgres/storage con anon=arwdDxtm e authenticated=arwdDxtm
--   DOPO   le stesse due righe con rdDxtm (senza a, senza w)
--   supabase_admin identico prima e dopo: vale per gli oggetti che crea Supabase.
-- ⚠️ Una riga di postgres IDENTICA nelle due fotografie è la risposta: l'alter
-- non è arrivato lì. Mandare il messaggio intero.

do $$
declare
  foto text;
  prima text;
  dopo text;
begin
  foto := $q$
    select coalesce(string_agg(pg_get_userbyid(d.defaclrole) || '/' || coalesce(n.nspname, '(tutti)') || ' ' || x::text,
                               E'\n' order by pg_get_userbyid(d.defaclrole), n.nspname, x::text), '(nessuna riga)')
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace, unnest(d.defaclacl) x
    where d.defaclobjtype = 'r' and (x::text like 'anon=%' or x::text like 'authenticated=%')
  $q$;
  execute foto into prima;
  alter default privileges in schema public  revoke insert, update on tables from anon, authenticated;
  alter default privileges in schema storage revoke insert, update on tables from anon, authenticated;
  execute foto into dopo;
  raise exception E'MISURA, NIENTE È STATO CAMBIATO (current_user = %)\n\nPRIMA\n%\n\nDOPO\n%',
    current_user, prima, dopo;
end $$;
