// Chi può eseguire una funzione, ricostruito dalle migrazioni — in un posto solo.
//
// PERCHÉ ESISTE QUESTO FILE, e non due copie. Due controlli hanno bisogno di
// sapere se una funzione è raggiungibile da chi non è nessuno:
// `verifica-grant-service-role.js` (un grant che nessun chiamante usa) e
// `verifica-guardie-null.js` (una definer che scrive e resta aperta ad `anon`).
// Con due copie del modello, quella non toccata diverge — è la malattia di
// casa, e il 26/09 il modello era sbagliato su due fatti insieme: se fossero
// state due copie, la riparazione ne avrebbe corretta una.
//
// DUE COSE VERIFICATE SU POSTGRES 16 IL 2026-09-26, non dedotte, e il modello
// di prima sbagliava su entrambe:
//
//  1. `PUBLIC` È NEL MAZZO. Alla nascita una funzione ha EXECUTE per PUBLIC
//     *oltre* ai due ruoli che i default privileges di Supabase concedono
//     (`anon`, `authenticated`), e **anon esegue anche solo attraverso
//     PUBLIC**: revocata da `anon` e non da `public`, un `set role anon;
//     select f()` risponde ancora. Un modello che non tiene `public` nel Set
//     dà per CHIUSA una funzione aperta — un verde falso, la direzione
//     peggiore.
//  2. `CREATE OR REPLACE` PRESERVA I PRIVILEGI. Solo il PRIMO `create` è una
//     nascita. Un modello che riparte dai default a ogni `create` dà per
//     riaperta una funzione revocata alla nascita e ridefinita dopo — un rosso
//     su codice giusto, cioè il modo in cui un controllo viene spento.
//
// Da qui due conseguenze che chi legge un permesso deve conoscere:
//  · «nessuna riga di permesso» NON vuol dire «nessuno può»: vuol dire che
//    nessuno ha tolto i default, cioè il caso peggiore;
//  · la riga che chiude è `from public, anon` — `revoke … from public` da solo
//    lascia i due ruoli, e `revoke … from anon` da solo lascia PUBLIC.
//
// LA TARATURA VIAGGIA COL MODELLO (`taraModello()`), e ogni controllo che usa
// questo file la esegue: un modello che si sposta deve far diventare rossi
// tutti i suoi lettori, non solo quello che qualcuno ricorda di guardare.

/* eslint-disable @typescript-eslint/no-require-imports -- modulo Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

// I ruoli con cui una funzione dello schema `public` nasce eseguibile.
const NASCE_CON = ["public", "anon", "authenticated"];

// Le tre righe che spostano un permesso, più la nascita. Un solo passaggio in
// ordine di documento: leggere prima tutti i grant e poi tutte le revoche
// darebbe la risposta sbagliata su un file che revoca e poi concede.
const RIGA =
  /(create\s+(?:or\s+replace\s+)?function|grant\s+execute\s+on\s+function|revoke\s+(?:all|execute)\s+on\s+function)\s+public\.([a-z_0-9]+)\s*\(([\s\S]*?)\)(\s*(?:to|from)\s+([^;]+);)?/gi;

/**
 * Ricostruisce, per ogni funzione, chi la può eseguire.
 * @param {{file: string, sql: string}[]} pezzi — le migrazioni in ordine.
 * @returns {Map<string, {ruoli: Set<string>, espliciti: Set<string>, file: string, firma: string}>}
 */
function applica(pezzi) {
  const stato = new Map();
  for (const { file, sql } of pezzi) {
    for (const m of sql.matchAll(RIGA)) {
      const verbo = m[1].toLowerCase();
      const nome = m[2];
      const firma = m[3].replace(/\s+/g, " ").trim();
      const ruoli = (m[5] ?? "")
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);

      if (verbo.startsWith("create")) {
        // Solo la PRIMA definizione è una nascita (vedi punto 2 in testa).
        if (!stato.has(nome)) {
          stato.set(nome, { ruoli: new Set(NASCE_CON), espliciti: new Set(), file, firma });
        }
        continue;
      }

      const v = stato.get(nome) ?? {
        ruoli: new Set(NASCE_CON),
        espliciti: new Set(),
        file,
        firma,
      };
      for (const r of ruoli) {
        if (verbo.startsWith("grant")) {
          v.ruoli.add(r);
          // `espliciti` serve a distinguere «può perché qualcuno gliel'ha dato»
          // da «può perché nessuno gliel'ha tolto»: togliere PUBLIC a una
          // funzione che passava SOLO da lì la rompe su un utente vero.
          v.espliciti.add(r);
        } else {
          v.ruoli.delete(r);
        }
      }
      stato.set(nome, { ...v, file });
    }
  }
  return stato;
}

/** Le migrazioni in ordine, pronte per `applica`. */
function leggiMigrazioni(dir) {
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((nome) => ({ file: nome, sql: fs.readFileSync(path.join(dir, nome), "utf8") }));
}

/** I permessi di una funzione di cui nessuna riga parla: i default, non il vuoto. */
const PREDEFINITI = () => ({
  ruoli: new Set(NASCE_CON),
  espliciti: new Set(),
  file: "nessuna riga di permesso",
  firma: "",
});

/** Raggiungibile da chi non la chiama: uno qualunque dei tre ruoli aperti. */
const aperto = (ruoli) => [...ruoli].some((r) => r === "public" || r === "anon" || r === "authenticated");

/** Chiusa a chi non è nessuno: né PUBLIC né `anon`. `authenticated` può restare. */
const chiusoAdAnon = (ruoli) => !ruoli.has("public") && !ruoli.has("anon");

// ── la taratura, che viaggia col modello ────────────────────────────────────
// Le cinque forme passano dal riduttore VERO: riscriverle a mano proverebbe la
// mia idea del modello invece del modello.
const PROVE_MODELLO = [
  [
    "create function public.z() returns int language sql as $$ select 1 $$;",
    true,
    "senza righe di permesso è APERTA (default privileges)",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from public;",
    true,
    "«revoke … from public» da solo non toglie anon: resta APERTA",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from anon, authenticated;",
    true,
    "«revoke … from anon, authenticated» senza public resta APERTA (anon passa da PUBLIC)",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from public, anon, authenticated;",
    false,
    "revocata da tutti e tre è CHIUSA",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from public, anon, authenticated;\ncreate or replace function public.z() returns int language sql as $$ select 2 $$;",
    false,
    "un «create or replace» successivo PRESERVA la revoca: resta CHIUSA",
  ],
];

// Le stesse cinque forme lette con l'altra domanda: `chiusoAdAnon` ammette
// `authenticated`, quindi non è `!aperto` e va tarata a parte.
const PROVE_ANON = [
  ["create function public.z() returns int language sql as $$ select 1 $$;", false, "alla nascita non è chiusa ad anon"],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from public, anon;",
    true,
    "revocata da public e anon è chiusa ad anon anche se authenticated resta",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from anon;",
    false,
    "revocata dal solo anon NON è chiusa: PUBLIC resta",
  ],
  [
    "create function public.z() returns int language sql as $$ select 1 $$;\nrevoke all on function public.z() from public;",
    false,
    "revocata dal solo public NON è chiusa: anon resta",
  ],
];

/** Esegue la taratura. Restituisce l'elenco delle prove che non tornano. */
function taraModello() {
  const rotte = [];
  for (const [sql, atteso, perche] of PROVE_MODELLO) {
    const s = applica([{ file: "prova.sql", sql }]).get("z") ?? PREDEFINITI();
    if (aperto(s.ruoli) !== atteso) rotte.push(`aperto: ${perche}`);
  }
  for (const [sql, atteso, perche] of PROVE_ANON) {
    const s = applica([{ file: "prova.sql", sql }]).get("z") ?? PREDEFINITI();
    if (chiusoAdAnon(s.ruoli) !== atteso) rotte.push(`chiusoAdAnon: ${perche}`);
  }
  return rotte;
}

const PROVE_TOTALI = PROVE_MODELLO.length + PROVE_ANON.length;

module.exports = {
  NASCE_CON,
  RIGA,
  applica,
  leggiMigrazioni,
  PREDEFINITI,
  aperto,
  chiusoAdAnon,
  taraModello,
  PROVE_TOTALI,
};
