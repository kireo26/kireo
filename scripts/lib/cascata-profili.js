// LA CASCATA COME DICHIARAZIONE DI APPARTENENZA.
//
// Serve un insieme che non si può derivare da una sintassi: «le tabelle che
// contengono dati di una persona». Il nome della colonna è un indizio e
// sbaglia già oggi (`student_id` in 28 file, `user_id` in 9 — fra cui
// `student_area_interests` e `presenze_live`, che sono profilazione a tutti
// gli effetti); una FK verso `profiles` è troppo larga, e prenderebbe
// `institution_profiles.user_id` insieme a `chiavi_trasmissione.aggiornata_da`.
//
// LA DERIVAZIONE CHE FUNZIONA È `on delete cascade`, e non è un trucco: è
// un'inferenza. La cascata dice chi è il proprietario perché è l'unico posto
// in cui qualcuno l'ha dovuto decidere riga per riga — scrivendo quella
// tabella, mesi o anni prima di questa domanda, si è chiesto esattamente la
// cosa giusta: «se quella persona sparisce, questa riga sparisce con lei?».
// Una `cascade` è un sì scritto; l'assenza di `on delete` (cioè `no action`,
// che BLOCCA) è un no scritto.
//
// Misurato il 10/10/2026 sulle 42 FK verso `profiles`/`student_profiles`: le
// dieci che bloccano sono TUTTE colonne di responsabilità — `verificato_da`,
// `certificata_da_user`, `creato_da`, `approvato_da`, `aggiornata_da`,
// `iscritto_da`, `mittente_user`, `proposta_da` — cioè righe di qualcun
// altro, che nominano chi ha agito. Nessuna eccezione, in nessun verso.
//
// ⚠️ QUESTO È UN LETTORE LESSICALE DELLE MIGRAZIONI, NON DEL DATABASE, e la
// ragione è che i controlli girano con `npm test`, senza una replica. Quindi
// non è la verità: è un'approssimazione che si PUÒ misurare contro la verità,
// e il modo è `scripts/verifica-cascata-profili.sql` — stampa la chiusura
// vera da `pg_constraint` perché la si confronti con quella di qui. Il giorno
// in cui le due divergono, è questo file a doversi spiegare.
//
// Due consumatori, una derivazione sola (altrimenti divergono):
//   • `verifica-export-dati.js` — l'export deve dare allo studente tutto
//     quello che discende da lui, o dire per iscritto perché no;
//   • il sovrainsieme di `TABELLE_DI_STUDENTI` in `verifica-misure-depurate.js`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const MIGRAZIONI = path.join(__dirname, "..", "..", "supabase", "migrations");

// Via i commenti di riga: una `references … on delete cascade` CITATA in un
// commento che spiega perché non c'è non è una FK. (La classe già pagata tre
// volte: un controllo lessicale che legge il commento che lo nomina.)
function senzaCommenti(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

// Il nome della tabella che si sta definendo: `create table [if not exists]
// public.X (` oppure `alter table [only] public.X`. Si tiene l'ultima vista,
// perché una FK appartiene alla tabella dentro la cui definizione si trova.
const INIZIO_TABELLA =
  /\b(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+only)?)\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;

// `references public.X (col) [on delete <azione>]` — la forma unica di questo
// repo (misurata: tutte e 97 le occorrenze qualificano lo schema).
const RIFERIMENTO =
  /\breferences\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*(?:\([^)]*\))?\s*(?:on\s+delete\s+(cascade|set\s+null|restrict|no\s+action))?/gi;

/**
 * Legge tutte le migrazioni e restituisce:
 *   tabelle   — Set dei nomi creati con `create table`
 *   archi     — [{ figlia, madre, cascata }] in ordine di apparizione
 */
function leggiMigrazioni() {
  const tabelle = new Set();
  const archi = [];

  for (const nome of fs.readdirSync(MIGRAZIONI).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = senzaCommenti(fs.readFileSync(path.join(MIGRAZIONI, nome), "utf8"));

    for (const m of sql.matchAll(/\bcreate\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)) {
      tabelle.add(m[1].toLowerCase());
    }

    // Si scorre il file una volta sola tenendo l'ultima tabella aperta: una
    // `references` appartiene a lei. Confrontare le posizioni è l'unico modo
    // di legare un riferimento alla propria tabella senza un vero parser.
    const inizi = [...sql.matchAll(INIZIO_TABELLA)].map((m) => ({ pos: m.index, tab: m[1].toLowerCase() }));
    for (const r of sql.matchAll(RIFERIMENTO)) {
      let figlia = null;
      for (const i of inizi) {
        if (i.pos < r.index) figlia = i.tab;
        else break;
      }
      if (!figlia) continue;
      const azione = (r[2] || "no action").replace(/\s+/g, " ").toLowerCase();
      archi.push({ figlia, madre: r[1].toLowerCase(), cascata: azione === "cascade", file: nome });
    }
  }

  return { tabelle, archi };
}

/**
 * La chiusura transitiva della cascata a partire da `profiles`: ogni tabella
 * le cui righe spariscono quando sparisce una persona, direttamente o
 * passando per un'altra tabella che sparisce con lei.
 *
 * `profiles` stessa non è nell'insieme: è la radice.
 */
function cascataDaProfili() {
  const { tabelle, archi } = leggiMigrazioni();
  const dentro = new Map(); // tabella -> livello
  let cambiato = true;
  let livello = 0;

  const madri = new Set(["profiles"]);
  while (cambiato && livello < 10) {
    cambiato = false;
    livello += 1;
    for (const a of archi) {
      if (!a.cascata) continue;
      if (!madri.has(a.madre)) continue;
      if (a.figlia === a.madre) continue;
      if (dentro.has(a.figlia)) continue;
      dentro.set(a.figlia, livello);
      cambiato = true;
    }
    for (const t of dentro.keys()) madri.add(t);
  }

  return { cascata: dentro, tabelle, archi };
}

module.exports = { cascataDaProfili, leggiMigrazioni, senzaCommenti };
