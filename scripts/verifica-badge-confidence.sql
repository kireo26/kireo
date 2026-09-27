-- Le sei proprietà del badge «confermata» dopo 20260927100000.
--
-- Si incolla nel SQL Editor di Supabase: gira in UNA transazione e finisce con
-- ROLLBACK, quindi non lascia niente. E finisce con un `select`, non con un
-- silenzio — un controllo che non dice com'è andato non è un controllo.
--
-- LE FIXTURE USANO `fonte='workshop'`/`'activity'` di proposito: quei due valori
-- saltano i filtri del primo-tentativo-valido (missione) e dell'ultimo-tentativo
-- (test), quindi la prova riguarda SOLO la regola del badge invece di dipendere
-- da mission_attempt/test_attempt. La chiave di `attivita_distinte` per loro è
-- `e.fonte::text`, quindi «una fonte» = 1 attività e «due fonti» = 2.
--
-- `confidence` = least(1, Σpeso/10): un Σpeso di 7,0 dà 0,70 (sopra 0,66), uno
-- di 3,0 dà 0,30 (sotto).

begin;

-- ── un utente e sei aree, tutte dello stesso studente ────────────────────────
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'badge@prova.invalid');
insert into public.profiles (id, ruolo, nome, cognome, data_nascita)
values ('11111111-1111-1111-1111-111111111111', 'studente', 'Prova', 'Badge', '2008-01-01');

-- P1 — conf 0,70 con UNA attività: prima «emergente», da oggi «confermata».
--      È la riga per cui la migrazione esiste.
insert into public.evidence (student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione) values
  ('11111111-1111-1111-1111-111111111111', 'edilizia-architettura', 'area', 'interest', 0.70, 7.0, 'workshop', 'una fonte sola, ma ricca');

-- P2 — conf 0,70 con DUE attività: «confermata» come prima (nessuna regressione).
insert into public.evidence (student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione) values
  ('11111111-1111-1111-1111-111111111111', 'salute-professioni-sanitarie', 'area', 'interest', 0.70, 4.0, 'workshop', 'prima fonte'),
  ('11111111-1111-1111-1111-111111111111', 'salute-professioni-sanitarie', 'area', 'interest', 0.70, 3.0, 'activity', 'seconda fonte');

-- P3 — conf 0,30: «emergente», e la soglia 0,66 non si è mossa.
insert into public.evidence (student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione) values
  ('11111111-1111-1111-1111-111111111111', 'comunicazione-media', 'area', 'interest', 0.70, 3.0, 'workshop', 'poco peso');

-- P4 — la tensione autoefficacia≠performance VINCE su «confermata»: conf 0,90,
--      una attività, se 90 contro perf 50 → «da_verificare».
insert into public.evidence (student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione) values
  ('11111111-1111-1111-1111-111111111111', 'informatica-digitale', 'area', 'interest', 0.70, 5.0, 'workshop', 'interesse'),
  ('11111111-1111-1111-1111-111111111111', 'informatica-digitale', 'area', 'self_efficacy', 0.90, 2.0, 'workshop', 'mi sento bravo'),
  ('11111111-1111-1111-1111-111111111111', 'informatica-digitale', 'area', 'performance', 0.50, 2.0, 'workshop', 'com''è andata');

-- P5 — la stessa tensione con conf BASSA (0,30) e una attività: «da_verificare»
--      comunque. Non è mai stata soggetta né alla confidence né alle attività,
--      e questo cambio non la tocca.
insert into public.evidence (student_id, area_slug, categoria, dimensione, valore, peso, fonte, motivazione) values
  ('11111111-1111-1111-1111-111111111111', 'lingue-relazioni-internazionali', 'area', 'self_efficacy', 0.90, 1.5, 'workshop', 'mi sento bravo'),
  ('11111111-1111-1111-1111-111111111111', 'lingue-relazioni-internazionali', 'area', 'performance', 0.50, 1.5, 'workshop', 'com''è andata');

select public.ricalcola_area_signal('11111111-1111-1111-1111-111111111111', a)
from unnest(array['edilizia-architettura','salute-professioni-sanitarie','comunicazione-media',
                  'informatica-digitale','lingue-relazioni-internazionali']) a;

-- ── le sei proprietà ─────────────────────────────────────────────────────────
with atteso(n, area, stato, attivita, nota) as (values
  (1, 'edilizia-architettura',           'confermata',    1, 'conf 0,70 con UNA attività → confermata (prima: emergente)'),
  (2, 'salute-professioni-sanitarie',    'confermata',    2, 'conf 0,70 con DUE attività → confermata (invariato)'),
  (3, 'comunicazione-media',             'emergente',     1, 'conf 0,30 → emergente: la soglia 0,66 non si è mossa'),
  (4, 'informatica-digitale',            'da_verificare', 1, 'la tensione se≠perf vince su confermata'),
  (5, 'lingue-relazioni-internazionali', 'da_verificare', 1, 'la tensione vale anche con conf bassa e una attività')
)
select
  t.n,
  case when s.status::text = t.stato and s.attivita_distinte = t.attivita then '✓' else '✗' end as esito,
  t.nota,
  s.status::text as stato_letto,
  round(s.confidence, 3) as confidence,
  s.attivita_distinte as att
from atteso t
left join public.area_signal s
  on s.student_id = '11111111-1111-1111-1111-111111111111' and s.area_slug = t.area
order by t.n;

-- P6 — `attivita_distinte` è uscita da una CONDIZIONE, non dalla tabella:
--      continua a essere calcolata e salvata, e resta un dato diagnostico.
select
  case when count(*) = 5 and count(attivita_distinte) = 5 and min(attivita_distinte) >= 1
       then '✓  6: attivita_distinte è ancora calcolata e salvata su tutte e 5 le righe'
       else '✗  6: attivita_distinte non è più scritta — è uscita dalla tabella, non solo da una condizione'
  end as esito
from public.area_signal
where student_id = '11111111-1111-1111-1111-111111111111';

rollback;
