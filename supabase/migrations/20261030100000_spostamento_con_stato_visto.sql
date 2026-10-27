-- LO SPOSTAMENTO DICE COSA HA VISTO CHI PREME (Mario, 27/10) — migrazione C di due.
--
-- ⚠️ IL CASO: l'ente apre «Sposta l'orario», legge «…da 2,00 a 3,00» e preme
-- dieci minuti dopo. Nel frattempo l'admin, da un altro computer, ha fissato le
-- ore a mano. Al browser dell'ente non arriva niente, e `sposta_finestra_evento`
-- a tre argomenti non sa cosa ha letto chi preme: lo spostamento cancella la
-- correzione dell'admin dopo che l'ente ha letto una frase vera — dieci minuti
-- prima. Proprio la frase che doveva avvisarlo («Le ore erano state fissate a
-- mano…») non c'era, perché quando l'ha letta non era ancora vera.
--
-- «Una garanzia che vale solo quando c'è una persona sola non è una garanzia
-- sul prodotto: è una garanzia sulla prova che abbiamo fatto.» (Mario)
--
-- LA CURA: chi sposta manda anche lo stato su cui l'anteprima ha scritto la sua
-- frase, e la funzione rifiuta con un errore SUO (`stato_cambiato`) se nel
-- frattempo è cambiato. Il form lo distingue da un guasto: rilegge l'anteprima e
-- dice che le ore sono cambiate mentre si guardava. «Due cose diverse che
-- arrivano come la stessa cosa fanno riprovare chi avrebbe dovuto rileggere.»
--
-- QUALE STATO, e perché tre valori e non `ore_pcto_fissate_il`: si confronta
-- esattamente ciò da cui `testoAnteprimaSpostamento` scrive la frase —
-- `ore_attuali`, `fissate_a_mano`, `aveva_fine` di `anteprima_spostamento_finestra`
-- — cioè quello che la persona ha LETTO. Due correzioni allo stesso valore danno
-- la stessa frase, e lì non c'è niente che la persona non sapesse.
--
-- ⚠️ NESSUN VALORE PREDEFINITO, e non per stile (Mario): un parametro con un
-- default farebbe passare un client vecchio senza il controllo e senza dirlo —
-- il silenzio che questa funzione esiste per togliere, costruito dentro di lei.
-- Un `null` passato apposta si confronta come un valore (`is distinct from`):
-- un evento vecchio con `ore_pcto` null ha davvero quello stato.
--
-- LA SOVRAPPOSIZIONE, in tre tempi: questa migrazione aggiunge la versione a sei
-- argomenti ACCANTO a quella a tre (PostgREST sceglie per nome degli argomenti);
-- il deploy porta il form alla nuova; `20261030110000` toglie quella a tre. Ogni
-- passo funziona da solo: applicata questa senza il deploy, il form vecchio
-- chiama la versione a tre e funziona come ieri. Non c'è una strada più corta
-- senza silenzi: sostituire la firma in un colpo romperebbe il form vecchio fra
-- la migrazione e il deploy; tenere la vecchia per sempre lascerebbe una porta
-- senza controllo.
--
-- `for update`: fra il confronto e l'update nessun'altra scrittura su quella
-- riga può infilarsi — senza, il controllo avrebbe una finestra sua.
--
-- COME SI VERIFICA APPLICATA: `to_regprocedure('public.sposta_finestra_evento(uuid,
-- timestamptz, timestamptz, numeric, boolean, boolean)')` non è null — l'oggetto
-- lo crea solo questa migrazione.

create or replace function public.sposta_finestra_evento(
  p_evento_id uuid,
  p_data_inizio timestamptz,
  p_data_fine timestamptz,
  p_ore_viste numeric,
  p_fissate_viste boolean,
  p_aveva_fine_vista boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizzatore uuid;
  v_chiusa timestamptz;
  v_ore numeric;
  v_fissate timestamptz;
  v_fine timestamptz;
begin
  select organizzatore_id, diretta_chiusa_il, ore_pcto, ore_pcto_fissate_il, data_fine
    into v_organizzatore, v_chiusa, v_ore, v_fissate, v_fine
  from public.eventi where id = p_evento_id
  for update;

  if not found then
    raise exception 'evento_non_trovato';
  end if;

  -- Rami affermativi con `else raise`: NULL-safe per costruzione.
  if public.current_ruolo() = 'admin' then
    null;
  elsif v_organizzatore is not null and v_organizzatore = public.current_istituzione_id() then
    null;
  else
    raise exception 'non_autorizzato';
  end if;

  if v_chiusa is not null then
    raise exception 'diretta_gia_chiusa';
  end if;

  if p_data_inizio is null or p_data_fine is null then
    raise exception 'date_mancanti';
  end if;

  if p_data_fine <= p_data_inizio then
    raise exception 'fine_prima_di_inizio';
  end if;

  if v_ore is distinct from p_ore_viste
     or (v_fissate is not null) is distinct from p_fissate_viste
     or (v_fine is not null) is distinct from p_aveva_fine_vista then
    raise exception 'stato_cambiato';
  end if;

  update public.eventi
  set data_inizio = p_data_inizio, data_fine = p_data_fine
  where id = p_evento_id;
end;
$$;

revoke all on function public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean) from public, anon;
grant execute on function public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean) to authenticated;

comment on function public.sposta_finestra_evento(uuid, timestamptz, timestamptz, numeric, boolean, boolean) is
  '20261030100000: sposta la finestra solo se ore, correzione a mano e presenza della fine sono quelli che l''anteprima ha mostrato a chi preme; altrimenti stato_cambiato.';
