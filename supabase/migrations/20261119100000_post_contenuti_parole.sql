-- LE PAROLE DEI CONTENUTI DEGLI ENTI (30/10). DA SOLA, PRIMA DI 20261119110000.
--
-- Un valore nuovo di un enum non si usa nella transazione che lo aggiunge:
-- per questo sta in un file suo, applicato in un'esecuzione separata (come
-- 20261113100000 per i post e 20261117100000 per la newsletter).
--
-- `file`: un post con un documento allegato che lo studente scarica. La strada
-- dello scaricamento è quella della guida (il server scrive la traccia prima di
-- mandare il file): vedi 20261119110000 e `app/api/scarica-allegato/[postId]`.

alter type public.post_ente_tipo add value if not exists 'file';

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'post_ente_tipo' and e.enumlabel = 'file'
  ) then
    raise exception 'rilettura: post_ente_tipo non ha il valore file';
  end if;
end $$;
