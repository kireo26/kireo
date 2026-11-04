-- 20261207100000 — LA NEWSLETTER RICEVUTA DICE CHI L'HA MANDATA (Mario, 04/11, §6d)
--
-- «Scarica i miei dati» elencava le newsletter ricevute con lo stato e la data,
-- e senza il mittente: la dichiarazione prometteva «le newsletter degli enti»,
-- e dal file non si capiva chi gliel'aveva mandata. Lo studente non legge
-- `newsletter_enti` dal client (la legge in KIREO da `newsletter_per_me`),
-- quindi il nome e l'oggetto si COPIANO sulla consegna quando nasce, come per
-- le guide (20261116100000): la riga dice quello che gli è arrivato, anche se un
-- giorno l'ente cambia nome.
--
-- Il corpo resta fuori dalla copia: è il testo dell'ente, lo studente lo legge
-- dalla notifica, e una copia del corpo su ogni consegna sarebbe la stessa
-- newsletter scritta N volte.
--
-- Il trigger e non `prepara_newsletter_del_giorno`: la funzione resta com'è, e
-- una consegna scritta da qualunque strada ha il suo mittente.
--
-- Da applicare PRIMA del deploy: il codice nuovo legge le due colonne.
-- Si rilegge da sé: nessuna consegna resta senza ente.

alter table public.newsletter_consegne add column ente_nome text, add column oggetto text;

comment on column public.newsletter_consegne.ente_nome is
  '20261207100000: il nome dell''ente che l''ha mandata, copiato quando la consegna nasce.';
comment on column public.newsletter_consegne.oggetto is
  '20261207100000: l''oggetto della newsletter, copiato quando la consegna nasce.';

create or replace function public.copia_mittente_newsletter()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select i.nome, n.oggetto into new.ente_nome, new.oggetto
    from public.newsletter_enti n join public.istituzioni i on i.id = n.istituzione_id
   where n.id = new.newsletter_id;
  return new;
end $$;
revoke execute on function public.copia_mittente_newsletter() from public, anon, authenticated;

create trigger newsletter_consegne_copia_mittente
  before insert on public.newsletter_consegne
  for each row execute function public.copia_mittente_newsletter();

update public.newsletter_consegne c
   set ente_nome = i.nome, oggetto = n.oggetto
  from public.newsletter_enti n join public.istituzioni i on i.id = n.istituzione_id
 where n.id = c.newsletter_id and c.ente_nome is null;

do $$
declare v int;
begin
  select count(*) into v from public.newsletter_consegne where ente_nome is null;
  if v > 0 then raise exception '20261207100000: % consegne senza ente dopo la copia', v; end if;
  if (select count(*) from pg_trigger where tgname = 'newsletter_consegne_copia_mittente') <> 1 then
    raise exception '20261207100000: il trigger non c''è';
  end if;
end $$;
