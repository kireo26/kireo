-- L'esito dell'email all'ente su una decisione di KIREO, scritto (30/10).
-- ⚠️ DA APPLICARE PRIMA DEL DEPLOY: la route nuova scrive qui, e senza la
-- tabella l'esito finirebbe solo nel log (la decisione regge lo stesso).
--
-- IL CASO CHE L'HA APERTA (Mario, 30/10, 09:28:02): una newsletter di Davante
-- approvata, la notifica dentro KIREO arrivata, l'email no — né in arrivo né in
-- spam. E non si poteva sapere perché, per due ragioni che stavano nel nostro
-- codice:
--   1. l'avviso «L'email all'ente non è partita» c'era, ma stava nella riga
--      della coda, e la coda si rilegge subito dopo la decisione: la riga
--      approvata esce, e l'avviso con lei. Un successo e un fallimento erano lo
--      stesso schermo;
--   2. un'email partita non lasciava niente: né l'ora, né a quanti account, né
--      l'identificativo che Brevo restituisce. Un'email «partita» e un'email
--      «mai tentata» erano la stessa assenza.
-- `guasti` copre il fallimento ma non il successo, e dura quanto dura: qui c'è
-- una riga per OGNI decisione, riuscita o no. *Un invio fallito non deve restare
-- muto, e un invio riuscito deve poterlo dimostrare.*
--
-- Non è di uno studente (nessuna chiave verso `profiles`): sta fuori
-- dall'export per costruzione. La scrive solo la service role (la route
-- dell'admin), la legge solo l'admin. Gli indirizzi non ci sono: solo quanti.

create table public.avvisi_email_enti (
  id uuid primary key default gen_random_uuid(),
  cosa text not null check (cosa in ('evento', 'newsletter')),
  riferimento_id uuid not null,
  istituzione_id uuid references public.istituzioni (id) on delete cascade,
  stato_decisione text,
  esito text not null check (esito in ('inviata', 'non_partita', 'nessun_destinatario', 'non_dovuta')),
  account_ente integer not null default 0 check (account_ente >= 0),
  inviate integer not null default 0 check (inviate >= 0),
  fallite integer not null default 0 check (fallite >= 0),
  motivo text,
  -- Gli identificativi che Brevo restituisce: con questi la consegna si
  -- cerca nei registri di Brevo, invece di indovinare l'ora.
  message_id text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint avvisi_email_non_partita_con_motivo check (esito <> 'non_partita' or motivo is not null)
);

comment on table public.avvisi_email_enti is
  '20261118100000: una riga per ogni email all''ente su una decisione di KIREO (evento o newsletter), riuscita o no. La scrive solo la service role; la legge l''admin in /admin («Email all''ente non partite»).';

create index avvisi_email_enti_riferimento_idx on public.avvisi_email_enti (riferimento_id, created_at desc);

alter table public.avvisi_email_enti enable row level security;
revoke all on public.avvisi_email_enti from anon, authenticated;
grant select on public.avvisi_email_enti to authenticated;

create policy avvisi_email_enti_select_admin
  on public.avvisi_email_enti for select
  to authenticated
  using (public.current_ruolo() = 'admin');

do $$
begin
  if to_regclass('public.avvisi_email_enti') is null then
    raise exception 'rilettura: la tabella non c''è';
  end if;
  if has_table_privilege('authenticated', 'public.avvisi_email_enti', 'INSERT')
     or has_table_privilege('authenticated', 'public.avvisi_email_enti', 'UPDATE')
     or has_table_privilege('anon', 'public.avvisi_email_enti', 'SELECT') then
    raise exception 'rilettura: il client scrive avvisi_email_enti, o un visitatore la legge';
  end if;
end $$;
