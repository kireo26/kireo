-- IL LIMITE DELLE AREE DI UN ENTE DIPENDE DAL TIPO, NON DAL PIANO (Mario, 27/10).
--
-- Il limite era 3 per tutti, nato il 26/07 con una ragione di simmetria
-- («stesso principio del fair-use eventi/post») e nessun fatto. Il fatto che
-- c'è: un'università copre più aree di una scuola di cucina, e con 3 è
-- costretta a dichiararne una parte, cioè a dire allo studente una cosa
-- incompleta su di sé.
--
-- ⚠️ NON SI LEGA AL PIANO, ed è la ragione per cui sta qui e non in `piani`:
-- un'area comprata diventa un'inserzione, e gli enti starebbero comprando la
-- fiducia dello studente nell'etichetta. Il tipo è un fatto sull'ente.
--
-- I NUMERI: 3 resta il normale; `universita` arriva a 6. ⚠️ Il 6 è la proposta
-- di Mario e lo conferma lui: si cambia qui, in un posto solo. Gli enti
-- «multi-disciplinari» non sono un tipo: oggi non c'è niente che li distingua,
-- e il giorno in cui servisse è un tipo nuovo, non un'eccezione per nome.
--
-- UN POSTO SOLO PER IL NUMERO: `max_aree_istituzione(uuid)`, che il trigger
-- usa e il form chiede (rpc). Il form non ha più una costante sua: due copie
-- dello stesso limite divergono.
--
-- ⚠️ IL TIPO LO SCRIVE L'ENTE: `istituzioni_update_propria` non limita le
-- colonne, quindi un ente potrebbe dichiararsi `universita` per avere 6 aree.
-- Oggi nessuna schermata permette di cambiare il tipo, e le aree passano dalla
-- revisione di KIREO. La condizione che lo rende un difetto: il giorno in cui
-- il tipo diventa modificabile dal profilo, il tipo esce dalla scrittura del
-- client (come `ore_pcto`).
--
-- SI APPLICA PRIMA DEL DEPLOY: il form nuovo chiama la funzione.
--
-- COME SI VERIFICA APPLICATA: `to_regprocedure('public.max_aree_istituzione(uuid)')`
-- non è null (la crea solo questa migrazione).

create or replace function public.max_aree_istituzione(p_istituzione_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case i.tipo when 'universita' then 6 else 3 end
  from public.istituzioni i
  where i.id = p_istituzione_id;
$$;

revoke all on function public.max_aree_istituzione(uuid) from public, anon;
grant execute on function public.max_aree_istituzione(uuid) to authenticated;

comment on function public.max_aree_istituzione(uuid) is
  '20261103110000: quante aree di competenza (non rifiutate) può avere un ente, dal suo tipo: universita 6, gli altri 3. Lo usa il trigger limite_aree_istituzione e lo chiede il form del profilo.';

create or replace function public.limite_aree_istituzione()
returns trigger
language plpgsql
as $$
declare
  v_conteggio integer;
begin
  select count(*) into v_conteggio
  from public.istituzioni_aree
  where istituzione_id = new.istituzione_id and stato <> 'rifiutata';

  if v_conteggio >= coalesce(public.max_aree_istituzione(new.istituzione_id), 3) then
    raise exception 'troppe_aree_istituzione';
  end if;

  return new;
end;
$$;
