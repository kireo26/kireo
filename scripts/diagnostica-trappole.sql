-- ═══════════════════════════════════════════════════════════════════════════
-- La trappola di ogni missione: è mai stata incontrata, e come?
--
-- Legge le RISPOSTE (step_response), non le prove: la scelta dello studente è
-- il dato autorevole, e c'è anche quando la prova non nasce. Serve perché la
-- trappola della Missione 10 ha `aree: []` — deliberatamente, vedi Fix C — e
-- quindi NON emette nessuna riga in `evidence`: cercandola lì risulterebbe
-- «mai incontrata» anche dopo dieci partite.
--
-- «tenuta» = la trappola NON è fra gli scartati. «scartata» = lo è.
-- Nella Missione 04 la trappola è INVERTITA (`trappolaSeScartata`): lì la mossa
-- pericolosa è scartarla, quindi le due colonne vanno lette al contrario.
-- ═══════════════════════════════════════════════════════════════════════════

-- L'elenco qui sotto è una COPIA di quello che sta in lib/escape/config.ts
-- (l'opzione con `trappola: true` di ogni `s3_scarto`). SQL non può leggere il
-- config TypeScript, quindi la copia è inevitabile: se un domani una trappola
-- cambia id, questa query lo dirà mostrando «MAI GIOCATA» su una missione che
-- invece è stata giocata. Rigenerabile in un attimo con lo stesso giro che l'ha
-- prodotta (scorrere `stepDellaMissione(m)` e prendere `opzioni.find(o=>o.trappola)`).
--
-- Verificata su Postgres 16 con tre tentativi sintetici, uno per esito:
-- trappola tenuta (08), trappola invertita scartata (04), trappola scartata
-- quando è giusto scartarla (01).

with trappole (mission_slug, trappola_id, invertita) as (
  values
    ('progetto-quartiere',  'facciata_pannelli',   false),
    ('crisi-mediateca',     'confermare_spiegare', false),
    ('guasto-serra',        'raddoppiare',         false),
    ('cantiere-scuola',     'accessibilita',       true),   -- scatta se SCARTATA
    ('sportello-insieme',   'chiedi_identita',     false),
    ('filiera-borea',       'beta_dichiara',       false),
    ('museo-seta',          'mostra_itinerante',   false),
    ('citta-acqua',         'chiusura_notturna',   false),
    ('palco-programma',     'spostare_orari',      false),
    ('classe-partecipa',    'faccio_da_solo',      false),
    ('viaggio-impossibile', 'chiedi_nadir',        false)
),
scarti as (
  -- Il LEFT JOIN tiene anche i tentativi che allo scarto non sono mai
  -- arrivati: sono un'informazione (quanti hanno smesso prima della Stanza 3),
  -- ma NON vanno contati come «tentativi con scarto». Il flag `giocato` è
  -- quello che separa i due gruppi — la prima stesura contava le righe del
  -- join e diceva 2 dove i giocati erano 1.
  select a.mission_slug,
         a.id as attempt_id,
         a.stato,
         coalesce(r.payload -> 'scartati', '[]'::jsonb) as scartati,
         (r.attempt_id is not null and coalesce(jsonb_array_length(r.payload -> 'scartati'), 0) > 0) as giocato
  from public.mission_attempt a
  left join public.step_response r
         on r.attempt_id = a.id and r.step_id = 's3_scarto'
)
select t.mission_slug,
       t.trappola_id,
       t.invertita,
       count(*) filter (where s.giocato)                                as scarto_giocato,
       count(*) filter (where s.attempt_id is not null and not s.giocato) as mai_arrivati_allo_scarto,
       count(*) filter (where s.giocato and s.scartati ? t.trappola_id) as volte_scartata,
       count(*) filter (where s.giocato
                          and not (s.scartati ? t.trappola_id))         as volte_tenuta,
       case
         when count(*) filter (where s.giocato) = 0 then 'MAI GIOCATA'
         when t.invertita and count(*) filter (where s.giocato and s.scartati ? t.trappola_id) > 0 then 'scattata (scartata)'
         when not t.invertita and count(*) filter (where s.giocato
                                                     and not (s.scartati ? t.trappola_id)) > 0 then 'scattata (tenuta)'
         else 'incontrata, mai scattata'
       end as esito
from trappole t
left join scarti s on s.mission_slug = t.mission_slug
group by t.mission_slug, t.trappola_id, t.invertita
order by 1;
