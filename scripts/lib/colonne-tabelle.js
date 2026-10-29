// Le colonne di una tabella, lette dalle migrazioni (29/10).
//
// Serve a `npm run test:export`: ogni colonna di una tabella esportata o sta
// nella `select` della sezione o sta in `COLONNE_ESCLUSE` con la sua ragione.
// Senza replica non c'è un catalogo da interrogare, quindi si leggono le
// migrazioni in ordine: `create table` (le colonne di primo livello del
// blocco), poi `alter table … add column / drop column / rename column`.
//
// ⚠️ LA DIREZIONE DELL'ERRORE: è un lettore lessicale, e una forma di DDL che
// non conosce (una colonna aggiunta da un `execute format`, per esempio) non
// la vede. Sbaglia per difetto. Per questo la guardia lo confronta con la
// replica quando c'è (`CONN`), e ha un pavimento su colonne note.
//
// Restituisce anche, per ogni tabella, le colonne che puntano a una persona
// (`references public.profiles` o `public.student_profiles`): in un file di
// dati personali sono quelle che possono portare l'identificativo di un altro.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./cascata-profili.js");

const MIGRAZIONI = path.join(__dirname, "..", "..", "supabase", "migrations");
const NON_COLONNE = new Set(["constraint", "primary", "unique", "check", "foreign", "exclude", "like"]);
const VERSO_PERSONA = /references\s+(?:public\.)?(profiles|student_profiles)\b/i;

/** Il contenuto fra la parentesi aperta in `da` e la sua chiusa. */
function blocco(sql, da) {
  let profondita = 0;
  for (let i = da; i < sql.length; i++) {
    if (sql[i] === "(") profondita++;
    else if (sql[i] === ")") {
      profondita--;
      if (profondita === 0) return sql.slice(da + 1, i);
    }
  }
  return null;
}

/** Spezza sulle virgole di primo livello. */
function pezzi(corpo) {
  const out = [];
  let profondita = 0;
  let inizio = 0;
  for (let i = 0; i < corpo.length; i++) {
    if (corpo[i] === "(") profondita++;
    else if (corpo[i] === ")") profondita--;
    else if (corpo[i] === "," && profondita === 0) {
      out.push(corpo.slice(inizio, i));
      inizio = i + 1;
    }
  }
  out.push(corpo.slice(inizio));
  return out.map((p) => p.trim()).filter(Boolean);
}

function colonneDalleMigrazioni(tabelle) {
  const voluti = new Set(tabelle);
  const colonne = new Map(); // tabella -> Map(colonna -> versoPersona)
  for (const nome of fs.readdirSync(MIGRAZIONI).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = senzaCommenti(fs.readFileSync(path.join(MIGRAZIONI, nome), "utf8"));

    for (const m of sql.matchAll(/\bcreate\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) {
      const t = m[1].toLowerCase();
      if (!voluti.has(t)) continue;
      const corpo = blocco(sql, m.index + m[0].length - 1);
      if (corpo === null) continue;
      const mappa = new Map();
      for (const p of pezzi(corpo)) {
        const c = p.match(/^"?([a-z_][a-z0-9_]*)"?/i);
        if (!c || NON_COLONNE.has(c[1].toLowerCase())) continue;
        mappa.set(c[1].toLowerCase(), VERSO_PERSONA.test(p));
      }
      colonne.set(t, mappa);
    }

    for (const m of sql.matchAll(/\balter\s+table(?:\s+if\s+exists)?(?:\s+only)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s+([^;]*);/gi)) {
      const t = m[1].toLowerCase();
      if (!voluti.has(t) || !colonne.has(t)) continue;
      const mappa = colonne.get(t);
      for (const p of pezzi(m[2])) {
        const add = p.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/i);
        if (add) mappa.set(add[1].toLowerCase(), VERSO_PERSONA.test(p));
        const drop = p.match(/^drop\s+column\s+(?:if\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/i);
        if (drop) mappa.delete(drop[1].toLowerCase());
        const ren = p.match(/^rename\s+column\s+"?([a-z_][a-z0-9_]*)"?\s+to\s+"?([a-z_][a-z0-9_]*)"?/i);
        if (ren) {
          const v = mappa.get(ren[1].toLowerCase()) ?? false;
          mappa.delete(ren[1].toLowerCase());
          mappa.set(ren[2].toLowerCase(), v);
        }
        // Una chiave esterna aggiunta dopo, su una colonna che c'è già.
        const fk = p.match(/^add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(\s*"?([a-z_][a-z0-9_]*)"?\s*\)\s*references\s+(?:public\.)?(profiles|student_profiles)\b/i);
        if (fk && mappa.has(fk[1].toLowerCase())) mappa.set(fk[1].toLowerCase(), true);
      }
    }
  }
  return colonne;
}

module.exports = { colonneDalleMigrazioni };
