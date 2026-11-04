-- 20261207110000 — IL NOME DI CHI HA CERTIFICATO, A SCHERMO COME NEL FILE (Mario, 04/11)
--
-- Il CSV della scuola stampa «Certificata da (nome)» anche per chi ha cancellato
-- l'account (la lapide tiene nome e cognome, 20261203100000), perché lo legge
-- una funzione definer. A schermo no: la scheda dello studente leggeva il nome
-- con un embed su `profiles`, che la scuola legge solo per lo staff ATTIVO della
-- propria scuola (`profiles_select_scuola_staff`). Quindi il nome spariva in
-- silenzio per un tutor disattivato, per un referente cancellato (la lapide non
-- ha più la riga nello staff), e per chiunque non fosse dello staff (l'ente,
-- KIREO). *La promessa fatta a chi si cancella — «il tuo nome resterà sulle
-- certificazioni» — era vera nel file e falsa sullo schermo.*
--
-- La cura è una lettura stretta: dato un elenco di persone, restituisce nome e
-- cognome solo di chi ha certificato la presenza di uno studente di QUESTA
-- scuola, e solo a referente o tutor della scuola. Non apre `profiles`: niente
-- data di nascita, telefono, indirizzo.
--
-- Da applicare PRIMA del deploy: la scheda e il registro la chiamano. Senza, il
-- nome manca e la pagina lo dice («chi ha certificato: non letto»).

create or replace function public.nomi_dei_certificatori(p_ids uuid[])
returns table (user_id uuid, nome text, cognome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.cognome
    from public.profiles p
   where p.id = any (p_ids)
     and public.current_ruolo_staff() in ('referente', 'tutor')
     and public.current_scuola_id() is not null
     and exists (
       select 1
         from public.iscrizioni_eventi ie
         join public.student_profiles sp on sp.user_id = ie.student_id
        where ie.certificata_da_user = p.id
          and ie.stato = 'partecipato'
          and sp.school_code = public.current_scuola_id()
     )
$$;
revoke all on function public.nomi_dei_certificatori(uuid[]) from public, anon;
grant execute on function public.nomi_dei_certificatori(uuid[]) to authenticated, service_role;

comment on function public.nomi_dei_certificatori(uuid[]) is
  '20261207110000: nome e cognome di chi ha certificato una presenza di uno studente della scuola di chi chiama, compresi un tutor disattivato e chi ha cancellato l''account. Solo a referente e tutor. Mai altri campi del profilo.';

do $$
begin
  if to_regprocedure('public.nomi_dei_certificatori(uuid[])') is null then
    raise exception '20261207110000: la funzione non c''è';
  end if;
  if has_function_privilege('anon', 'public.nomi_dei_certificatori(uuid[])', 'execute') then
    raise exception '20261207110000: anon la esegue';
  end if;
end $$;
