#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:colonne` — LE COLONNE CHE IL CLIENT PUÒ SCRIVERE (Mario, 27/10:
// «abbiamo chiuso 35 porte e lasciato aperta la fabbrica che le produce»).
//
// Dal 20261106100000 il valore di partenza è rovesciato: anon e authenticated
// non scrivono niente, e ogni colonna è concessa una per una. Il registro è
// `supabase/colonne-del-client.json`. Questa guardia è rossa quando una tabella
// o una colonna diventa scrivibile senza essere stata dichiarata, e lo guarda da
// quattro parti, perché ognuna da sola ha un buco:
//
//   §1 il registro sta in piedi da solo (chi scrive, nessun doppione, il tetto);
//   §2 le migrazioni concedono ESATTAMENTE il registro: dal rovesciamento in poi
//      nessuna concessione di tabella intera, nessun privilegio predefinito
//      riaperto, e lo stato che risulta è il registro (nei due versi);
//   §3 il codice non scrive una colonna che il registro non concede — il verso
//      che in produzione fa «permission denied» davanti a una persona;
//   §4 ogni colonna del registro ha qualcuno che la scrive: una concessione
//      senza scrittore è una porta che nessuno usa, ed è da lì che si riapre
//      l'abitudine;
//   §5 sulla replica (CONN), i privilegi VERI sono il registro, e le funzioni non
//      definer che scrivono con i privilegi di chi chiama non escono dal
//      registro. Senza replica dice di non aver guardato.
//
// ⚠️ I LIMITI, dichiarati: §2 e §3 sono lessicali. §3 legge gli oggetti scritti
// a mano in `.insert({…})`/`.update({…})`/`.upsert({…})`; una scrittura con un
// oggetto costruito altrove o una tabella in una variabile non la vede da sé, e
// per questo ogni `.from(variabile)` che scrive deve stare in DINAMICHE con le
// sue colonne — una nuova non dichiarata è rossa. §5 è la metà che guarda il
// sistema, e gira solo dove c'è un Postgres (`npm run sql:tutti` la lancia).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
const REGISTRO_FILE = path.join(ROOT, "supabase", "colonne-del-client.json");
const MIGRAZIONI = path.join(ROOT, "supabase", "migrations");
const ROVESCIAMENTO = "20261106100000";
const RUOLI = ["anon", "authenticated"];

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}

// Un insieme di chiavi «ruolo.tabella.comando.colonna»: il linguaggio comune
// delle quattro metà, così i confronti sono differenze di insiemi.
const chiave = (ruolo, tabella, comando, colonna) => `${ruolo}.${tabella}.${comando}.${colonna}`;
const differenza = (a, b) => [...a].filter((x) => !b.has(x)).sort();

// ── §1 il registro ──────────────────────────────────────────────────────────
console.log("\n§1 — il registro sta in piedi da solo\n");
const registro = JSON.parse(fs.readFileSync(REGISTRO_FILE, "utf8"));
const dichiarate = new Set();
{
  let senzaChi = [];
  let doppioni = [];
  for (const ruolo of RUOLI) {
    for (const [tabella, voce] of Object.entries(registro[ruolo] ?? {})) {
      if (!voce.chi || voce.chi.trim().length < 10) senzaChi.push(`${ruolo}.${tabella}`);
      for (const comando of ["insert", "update"]) {
        for (const colonna of voce[comando] ?? []) {
          const k = chiave(ruolo, tabella, comando, colonna);
          if (dichiarate.has(k)) doppioni.push(k);
          dichiarate.add(k);
        }
      }
    }
  }
  ok(senzaChi.length === 0, "ogni tabella del registro dice chi la scrive", senzaChi.join(", "));
  ok(doppioni.length === 0, "nessuna colonna dichiarata due volte", doppioni.join(", "));
  // IL CRICCHETTO: il numero delle colonne aperte può solo scendere. Si alza
  // solo cambiando il tetto nel registro, cioè dicendolo.
  ok(dichiarate.size <= registro.tetto_colonne, `colonne aperte al client: ${dichiarate.size} (tetto ${registro.tetto_colonne})`,
    "ne è stata aperta una in più del tetto: se serve davvero, il tetto si alza nello stesso commit, e il perché va nella migrazione");
  if (dichiarate.size < registro.tetto_colonne) {
    console.log(`      → il tetto si può abbassare a ${dichiarate.size}: ne sono state chiuse ${registro.tetto_colonne - dichiarate.size}`);
  }
}

// ── §2 le migrazioni ────────────────────────────────────────────────────────
console.log("\n§2 — le migrazioni concedono esattamente il registro\n");
const migrazioni = fs.readdirSync(MIGRAZIONI).filter((f) => f.endsWith(".sql")).sort();
const daRovesciamento = migrazioni.filter((f) => f >= ROVESCIAMENTO);
const concesse = new Set();
{
  // IL PAVIMENTO sta su quello che non scende quando il prodotto migliora
  // (Mario, 27/10): le migrazioni lette e le tabelle create. Un lettore cieco li
  // fa cadere a zero; chiudere una colonna non li tocca.
  const create = migrazioni.reduce((n, f) => n + (fs.readFileSync(path.join(MIGRAZIONI, f), "utf8").match(/create table (if not exists )?public\.\w+/gi) ?? []).length, 0);
  ok(migrazioni.length >= 130, `le migrazioni lette: ${migrazioni.length} (pavimento 130)`);
  ok(create >= 60, `le tabelle create che il lettore trova: ${create} (pavimento 60)`);
  ok(daRovesciamento[0]?.startsWith(ROVESCIAMENTO), "la migrazione del rovesciamento c'è, ed è il punto da cui si conta");

  const vietate = [];
  for (const f of daRovesciamento) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(MIGRAZIONI, f), "utf8"));
    const frasi = sql.split(";").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    for (const frase of frasi) {
      // Un grant di tabella intera (senza le parentesi delle colonne) al client:
      // è esattamente la forma che il rovesciamento esiste per non rivedere.
      const tab = frase.match(/^grant ([a-z, ]+?) on (table |all tables in schema )?(public[.\w]*) to (.+)$/i);
      if (tab && /\b(insert|update|all)\b/i.test(tab[1]) && /\b(anon|authenticated|public)\b/i.test(tab[4])) {
        vietate.push(`${f}: ${frase.slice(0, 90)}`);
      }
      if (/^alter default privileges .* grant .*\b(insert|update|all)\b.* to .*\b(anon|authenticated)\b/i.test(frase)) {
        vietate.push(`${f}: ${frase.slice(0, 90)}`);
      }
      // Lo stato: il rovesciamento azzera, poi le concessioni e le revoche di colonna.
      if (/^revoke insert, update on all tables in schema public from anon, authenticated$/i.test(frase)) concesse.clear();
      const col = frase.match(/^(grant|revoke) (insert|update) \(([^)]*)\) on (?:table )?public\.(\w+) (to|from) ([\w ,]+)$/i);
      if (col) {
        const colonne = col[3].split(",").map((s) => s.trim());
        const ruoli = col[6].split(",").map((s) => s.trim()).filter((r) => RUOLI.includes(r));
        for (const ruolo of ruoli) {
          for (const c of colonne) {
            const k = chiave(ruolo, col[4], col[2].toLowerCase(), c);
            if (col[1].toLowerCase() === "grant") concesse.add(k);
            else concesse.delete(k);
          }
        }
      }
    }
  }
  ok(vietate.length === 0, "dal rovesciamento in poi nessuna concessione di tabella intera al client, e nessun predefinito riaperto", vietate.join("\n        "));
  const inPiu = differenza(concesse, dichiarate);
  const inMeno = differenza(dichiarate, concesse);
  ok(concesse.size > 100, `le concessioni di colonna lette dalle migrazioni: ${concesse.size}`);
  ok(inPiu.length === 0, "le migrazioni non concedono niente che il registro non dichiari", inPiu.join(", "));
  ok(inMeno.length === 0, "e il registro non dichiara niente che le migrazioni non concedano", inMeno.join(", "));
}

// ── §3 il codice ────────────────────────────────────────────────────────────
console.log("\n§3 — il codice non scrive una colonna che il registro non concede\n");

// Le scritture con la tabella in una variabile, o con un oggetto costruito
// altrove: il lettore non le vede da sé, quindi sono dichiarate qui con le loro
// colonne, e un'àncora che sparisce è rossa (una dichiarazione che non descrive
// più il codice è peggio di nessuna).
const DINAMICHE = [
  {
    file: "components/admin/AzioneApprovazione.tsx",
    ancora: ".update({ stato, note_revisione:",
    scritture: [
      ["eventi", "update", ["stato", "note_revisione"]],
      ["comunicazioni", "update", ["stato", "note_revisione"]],
    ],
    perche: "`.from(tabella)`: la stessa approvazione per eventi e comunicazioni",
  },
  {
    file: "app/api/escape/finalizza/route.ts",
    ancora: 'sostituisci("journal_entry", { student_id: user.id, attempt_id: attempt.id, testo: riflessione })',
    scritture: [["journal_entry", "insert", ["student_id", "attempt_id", "testo"]]],
    perche: "`sostituisci(tabella, riga)`: prima la copia nuova, poi via le vecchie",
  },
  {
    file: "app/api/escape/finalizza/route.ts",
    ancora: 'sostituisci("portfolio_item", {',
    scritture: [["portfolio_item", "insert", ["student_id", "attempt_id", "titolo", "contenuto"]]],
    perche: "`sostituisci(tabella, riga)`",
  },
  {
    file: "components/scuola/TogglePermessiTutor.tsx",
    ancora: ".update({ [chiave]: nuovoValore })",
    scritture: [["school_staff", "update", ["puo_verificare_studenti", "puo_gestire_classi", "puo_certificare_presenze", "puo_inviare_comunicazioni"]]],
    perche: "la chiave è una delle quattro deleghe",
  },
];

// Le funzioni NON definer che scrivono con i privilegi di chi chiama: le loro
// colonne contano come scritture del client. La metà che le confronta con le
// definizioni vere è in §5, sulla replica.
const FUNZIONI_NON_DEFINER = [
  ["finalize_registration", "authenticated", "profiles", "insert", ["id", "ruolo", "nome", "cognome", "data_nascita"]],
  ["finalize_registration", "authenticated", "student_profiles", "insert", ["user_id", "school_code", "classe", "anno_diploma"]],
  ["finalize_registration", "authenticated", "student_area_interests", "insert", ["user_id", "area_slug"]],
  ["finalize_registration", "authenticated", "teacher_profiles", "insert", ["user_id", "school_code", "materia", "is_referente_orientamento"]],
  ["crea_invito_tutor", "authenticated", "school_staff", "insert", ["scuola_profilo_id", "ruolo_staff", "user_id", "codice_invito", "nome_invitato", "email_invitato", "creato_da"]],
  ["invia_messaggio_scuola", "authenticated", "messaggi_scuola", "insert", ["id", "scuola_profilo_id", "mittente_user", "destinatari", "classe_id", "oggetto", "corpo", "canale"]],
  ["invia_messaggio_scuola", "authenticated", "messaggi_scuola_destinatari", "insert", ["messaggio_id", "student_id"]],
  ["approva_richiesta_upgrade", "authenticated", "istituzioni", "update", ["piano_id", "piano_attivato_il", "piano_scade_il"]],
  ["approva_richiesta_upgrade", "authenticated", "richieste_upgrade", "update", ["stato", "note_kireo"]],
];

// I file con la service-role non passano dai privilegi del client: fuori.
const CARTELLE = ["app", "lib", "components", "scripts/banco"];
function sorgenti(dir) {
  const assoluta = path.join(ROOT, dir);
  if (!fs.existsSync(assoluta)) return [];
  return fs.readdirSync(assoluta, { withFileTypes: true }).flatMap((v) => {
    const rel = path.join(dir, v.name);
    if (v.isDirectory()) return v.name === "node_modules" ? [] : sorgenti(rel);
    return /\.(ts|tsx|js)$/.test(v.name) ? [rel] : [];
  });
}

// L'argomento di una chiamata, dalla parentesi aperta alla sua chiusa.
function argomento(src, inizio) {
  let prof = 0;
  let stringa = null;
  for (let i = inizio; i < src.length; i++) {
    const c = src[i];
    if (stringa) {
      if (c === "\\") i++;
      else if (c === stringa) stringa = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") stringa = c;
    else if ("({[".includes(c)) prof++;
    else if (")}]".includes(c)) {
      prof--;
      if (prof === 0) return src.slice(inizio + 1, i);
    }
  }
  return null;
}

// Le chiavi del primo oggetto letterale di un argomento, o null se non ce n'è
// uno, o se ha una chiave calcolata o uno spread (allora è dinamico).
function primaGraffa(arg) {
  // La prima graffa FUORI dalle stringhe: una `{` dentro un testo non apre un oggetto.
  let stringa = null;
  for (let i = 0; i < arg.length; i++) {
    const c = arg[i];
    if (stringa) {
      if (c === "\\") i++;
      else if (c === stringa) stringa = null;
    } else if (c === '"' || c === "'" || c === "`") stringa = c;
    else if (c === "{") return i;
  }
  return -1;
}

function chiaviOggetto(arg) {
  const a = primaGraffa(arg);
  if (a === -1) return null;
  const corpo = argomento(arg, a);
  if (corpo === null) return null;
  const voci = [];
  let prof = 0;
  let stringa = null;
  let corrente = "";
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i];
    if (stringa) {
      corrente += c;
      if (c === "\\") corrente += corpo[++i];
      else if (c === stringa) stringa = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") stringa = c;
    if ("({[".includes(c)) prof++;
    if (")}]".includes(c)) prof--;
    if (c === "," && prof === 0) {
      voci.push(corrente);
      corrente = "";
    } else corrente += c;
  }
  if (corrente.trim()) voci.push(corrente);
  const chiavi = [];
  for (const v of voci) {
    const s = v.trim();
    if (!s) continue;
    const m = s.match(/^(?:"(\w+)"|'(\w+)'|(\w+))\s*:/) ?? s.match(/^(\w+)$/);
    if (!m) return null;
    chiavi.push(m[1] ?? m[2] ?? m[3]);
  }
  return chiavi;
}

const scritteDalCodice = new Set();
let sitiLetti = 0;
{
  const fuori = [];
  const nonDichiarate = [];
  const ancoreMorte = [];
  let fileLetti = 0;
  for (const f of CARTELLE.flatMap(sorgenti)) {
    const src = senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
    if (/createServiceRoleClient|supabaseServiceRoleKey/.test(src)) continue;
    fileLetti++;
    // L'anon key: il modulo di /contatti scrive senza sessione. Le altre scritture
    // del client sono di un collegato.
    // Solo l'insert: «gestita» la scrive l'admin, collegato.
    const ruoloDi = (tabella, c) => (tabella === "richieste_contatto" && c === "insert" ? ["anon", "authenticated"] : ["authenticated"]);
    const re = /\.from\(\s*(["'`]?)(\w+)\1\s*\)((?:(?!\.from\()[\s\S]){0,240}?)\.(insert|update|upsert)\(/g;
    let m;
    while ((m = re.exec(src))) {
      const letterale = m[1] !== "";
      const tabella = m[2];
      const comando = m[4];
      const riga = src.slice(0, m.index).split("\n").length;
      if (!letterale) {
        nonDichiarate.push(`${f}:${riga} .from(${tabella}).${comando}`);
        continue;
      }
      sitiLetti++;
      const arg = argomento(src, m.index + m[0].length - 1);
      const chiavi = arg === null ? null : chiaviOggetto(arg);
      if (chiavi === null) {
        const dichiarata = DINAMICHE.some((d) => d.file === f && d.scritture.some(([t]) => t === tabella));
        if (!dichiarata) nonDichiarate.push(`${f}:${riga} ${tabella}.${comando}(…)`);
        continue;
      }
      // Un upsert è un insert che, sul conflitto, riscrive ogni colonna che manda;
      // un upsert con ignoreDuplicates è un insert … on conflict do nothing.
      const comandi = comando === "upsert" ? (/ignoreDuplicates:\s*true/.test(arg) ? ["insert"] : ["insert", "update"]) : [comando];
      for (const c of comandi) {
        for (const ruolo of ruoloDi(tabella, c)) {
          for (const col of chiavi) {
            const k = chiave(ruolo, tabella, c, col);
            scritteDalCodice.add(k);
            if (!dichiarate.has(k)) fuori.push(`${f}:${riga} ${k}`);
          }
        }
      }
    }
    // Le .from(variabile) che scrivono: ognuna dichiarata in DINAMICHE.
  }
  for (const d of DINAMICHE) {
    const src = fs.existsSync(path.join(ROOT, d.file)) ? senzaCommenti(fs.readFileSync(path.join(ROOT, d.file), "utf8")) : "";
    if (!src.includes(d.ancora)) ancoreMorte.push(`${d.file}: «${d.ancora}»`);
    for (const [tabella, comando, colonne] of d.scritture) {
      for (const col of colonne) {
        const k = chiave("authenticated", tabella, comando, col);
        scritteDalCodice.add(k);
        if (!dichiarate.has(k)) fuori.push(`${d.file} (dinamica) ${k}`);
      }
    }
  }
  for (const [, ruolo, tabella, comando, colonne] of FUNZIONI_NON_DEFINER) {
    for (const col of colonne) scritteDalCodice.add(chiave(ruolo, tabella, comando, col));
  }
  // Le .from(variabile) senza una voce in DINAMICHE: le tre dichiarate oggi
  // sono AzioneApprovazione (una) e finalizza (una, per due tabelle).
  const variabiliDichiarate = nonDichiarate.filter((s) =>
    DINAMICHE.some((d) => s.startsWith(`${d.file}:`) && /\.from\(\w+\)\./.test(s)),
  );
  const daDichiarare = nonDichiarate.filter((s) => !variabiliDichiarate.includes(s));
  ok(fileLetti >= 300, `i file letti dal lettore delle scritture: ${fileLetti} (pavimento 300)`);
  ok(sitiLetti >= 50, `le scritture con la tabella scritta per nome: ${sitiLetti} (pavimento 50)`);
  ok(fuori.length === 0, "nessuna scrittura del codice su una colonna che il registro non concede", fuori.join("\n        "));
  ok(daDichiarare.length === 0, "ogni scrittura che il lettore non sa leggere è dichiarata in DINAMICHE", daDichiarare.join("\n        "));
  ok(ancoreMorte.length === 0, "ogni voce di DINAMICHE descrive ancora il codice (la sua àncora c'è)", ancoreMorte.join("\n        "));
}

// ── §4 nessuna porta senza scrittore ────────────────────────────────────────
console.log("\n§4 — ogni colonna del registro ha qualcuno che la scrive\n");
{
  const senzaScrittore = differenza(dichiarate, scritteDalCodice);
  ok(senzaScrittore.length === 0, "nessuna colonna concessa che nessun codice e nessuna funzione scrivono", senzaScrittore.join(", "));
}

// ── §5 la replica ───────────────────────────────────────────────────────────
console.log("\n§5 — sulla replica, i privilegi veri sono il registro\n");
const CONN = process.env.CONN;
if (!CONN) {
  console.log("  · NON HO GUARDATO: nessuna replica (CONN non è impostata). La lancia `npm run sql:tutti`;");
  console.log("    in produzione la stessa domanda la fa scripts/diagnostica-colonne-del-client.sql.");
} else {
  const psql = (q) => execFileSync("psql", [CONN, "-At", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
  const vere = new Set(
    psql(`select r.ruolo, c.relname, lower(p.priv), a.attname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      cross join (values ('anon'), ('authenticated')) r(ruolo) cross join (values ('INSERT'), ('UPDATE')) p(priv)
      where c.relkind = 'r' and has_column_privilege(r.ruolo, c.oid, a.attname, p.priv)`)
      .split("\n").filter(Boolean).map((l) => l.split("|").join(".")),
  );
  ok(vere.size > 100, `le colonne scrivibili lette dalla replica: ${vere.size}`);
  ok(differenza(vere, dichiarate).length === 0, "la replica non concede niente che il registro non dichiari", differenza(vere, dichiarate).join(", "));
  ok(differenza(dichiarate, vere).length === 0, "e il registro non dichiara niente che la replica non conceda", differenza(dichiarate, vere).join(", "));
  const predefiniti = psql(`select coalesce(string_agg(x::text, ','), '') from pg_default_acl d, unnest(d.defaclacl) x
    where d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'r' and (x::text like 'anon=%' or x::text like 'authenticated=%')
      and split_part(split_part(x::text, '=', 2), '/', 1) ~ '[aw]'`);
  ok(predefiniti === "", "i privilegi predefiniti non concedono insert o update al client: una tabella nuova nasce chiusa", predefiniti);
  // Le funzioni non definer che scrivono: le loro colonne vere contro FUNZIONI_NON_DEFINER.
  const corpi = psql(`select p.proname || '§' || replace(p.prosrc, chr(10), ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not p.prosecdef and p.prosrc ~* '(insert\\s+into|update\\s+(public\\.)?[a-z_]+\\s+set)'`)
    .split("\n").filter(Boolean);
  const nomi = corpi.map((r) => r.split("§")[0]);
  const attese = [...new Set(FUNZIONI_NON_DEFINER.map((x) => x[0]))].sort();
  ok(JSON.stringify([...new Set(nomi)].sort()) === JSON.stringify(attese), `le funzioni non definer che scrivono sono quelle dichiarate (${attese.join(", ")})`, [...new Set(nomi)].sort().join(", "));
  const fuoriFunzioni = [];
  for (const r of corpi) {
    const [nome, corpo] = r.split("§");
    for (const m of corpo.matchAll(/insert into (?:public\.)?(\w+) \(([^)]*)\)/gi)) {
      for (const col of m[2].split(",").map((s) => s.trim())) {
        if (!dichiarate.has(chiave("authenticated", m[1], "insert", col))) fuoriFunzioni.push(`${nome}: ${m[1]}.insert.${col}`);
      }
    }
    for (const m of corpo.matchAll(/update (?:public\.)?(\w+)\s+set\s+(.*?)\s+where/gi)) {
      for (const assegnazione of m[2].matchAll(/(\w+)\s*=/g)) {
        if (!dichiarate.has(chiave("authenticated", m[1], "update", assegnazione[1]))) fuoriFunzioni.push(`${nome}: ${m[1]}.update.${assegnazione[1]}`);
      }
    }
  }
  ok(fuoriFunzioni.length === 0, "le funzioni non definer non scrivono colonne fuori dal registro", fuoriFunzioni.join(", "));
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:colonne)`);
process.exit(falliti === 0 ? 0 : 1);
