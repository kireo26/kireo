// Una guardia che con NULL non scatta lascia passare chi non ha un'identità.
//
// PERCHÉ ESISTE. `X <> NULL` non è falso: è NULL, e un `if` su NULL non esegue
// il ramo. Quindi `if mio <> tuo then raise 'non_autorizzato'` **lascia
// passare esattamente chi non ha un'identità** — l'anonimo, o l'utente che non
// è della categoria che quella funzione si aspetta. È il caso che la riga
// doveva fermare.
//
// È la specie più ricorrente di questo progetto: CLAUDE.md la racconta almeno
// sei volte (`verifica_studente` e le altre dell'area scuola, luglio;
// `approva_richiesta_upgrade`; `blocca_autoescalation_istituzione`;
// `blocca_autoflag_di_prova`). Ogni volta è stata trovata leggendo, e ogni
// volta è ricomparsa da un'altra parte qualche settimana dopo — perché la
// forma sbagliata è quella che viene in mente per prima.
//
// COSA GUARDA, e perché ristretto. Solo le funzioni SECURITY DEFINER che
// SCRIVONO: lì la RLS non fa da rete (la funzione gira come proprietario) e
// una guardia che non scatta è l'unica cosa fra un estraneo e una scrittura.
// Una definer di sola lettura con lo stesso difetto espone dei dati, che è
// grave in un altro modo — ma allargare qui vorrebbe dire includere anche i
// `<>` che stanno in una `where` invece che in un `if`, dove un NULL esclude
// la riga e quindi **fallisce chiuso**. Un controllo che grida su cose giuste
// è un controllo che qualcuno disattiva.
//
// GLI HELPER CHE POSSONO TORNARE NULL sono elencati apposta: non tutti lo
// fanno. `current_ha_permesso_staff` avvolge il risultato in un `coalesce
// (…, false)` proprio per non cadere qui, ed è documentato in migrazione:
// includerlo produrrebbe un rosso su una funzione scritta bene.
//
// LA CURA è sempre la stessa: `is distinct from`, che con NULL si comporta
// come chiunque si aspetti (NULL è diverso da un valore, quindi la guardia
// scatta). Il messaggio di questo controllo la dice, perché un test che
// segnala senza dire cosa scrivere fa perdere il tempo che voleva far
// risparmiare.
//
// Esecuzione: `npm run test:guardie`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "supabase", "migrations");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) {
    console.error("  ✗ " + msg);
    falliti++;
  } else {
    console.log("  ✓ " + msg);
  }
};

// Gli helper di identità che restituiscono NULL quando chi chiama non è della
// categoria attesa. Chi NON sta qui è perché non può tornare NULL.
const NULLABILI = /(auth\.uid|current_ruolo|current_istituzione_id|current_scuola_id|current_ruolo_staff|current_school_code)\s*\(\)/;

// Un confronto che con NULL non scatta.
const FRAGILE =
  /(<>|!=)\s*(public\.)?(auth\.uid|current_\w+)\s*\(\)|(public\.)?(auth\.uid|current_\w+)\s*\(\)\s*(<>|!=)|\bnot\s+in\s*\(/i;

// Righe note e lette, che restano per una ragione scritta.
const ESENTI = [
  {
    funzione: "peers_workshop",
    contiene: "wi.student_id <> auth.uid()",
    perche:
      "non è una guardia: è il filtro «non mostrare me stesso» dentro una WHERE. " +
      "Con auth.uid() NULL la condizione vale NULL e la riga viene ESCLUSA — fallisce " +
      "chiuso, cioè nella direzione giusta. L'autorizzazione vera di quella funzione è " +
      "un EXISTS separato sulla propria iscrizione.",
  },
];

// ── estrazione ──────────────────────────────────────────────────────────────
// L'ULTIMA definizione di un nome è quella viva: i file si leggono in ordine e
// una `create or replace` successiva sostituisce la precedente. Guardare una
// definizione vecchia vorrebbe dire dare rosso su un difetto già riparato.
const fn = new Map();
for (const nome of fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(DIR, nome), "utf8");
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([\s\S]*?\)\s*returns([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\3\$/gi;
  let m;
  while ((m = re.exec(sql))) {
    fn.set(m[1], { nome: m[1], file: nome, testa: m[2], corpo: m[4] });
  }
}

console.log("\n═══ Nessuna guardia che con NULL lascia passare ═══\n");

// LA GUARDIA DELL'ESTRATTORE. Se smettesse di riconoscere la forma di una
// definizione, questo file passerebbe verde senza aver guardato niente — che è
// il modo peggiore di fallire, perché somiglia a un successo.
ok(fn.size >= 80, `l'estrattore legge le funzioni dalle migrazioni (${fn.size})`);

const definer = [...fn.values()].filter((f) => /security\s+definer/i.test(f.testa));
const scrivono = definer.filter((f) => /\b(insert\s+into|update\s+\w|delete\s+from)\b/i.test(f.corpo));
ok(scrivono.length >= 20, `…di cui SECURITY DEFINER che scrivono: ${scrivono.length}`);

// ── il controllo ────────────────────────────────────────────────────────────
const fragili = [];
for (const f of scrivono) {
  for (const riga of f.corpo.split("\n")) {
    if (!FRAGILE.test(riga) || !NULLABILI.test(riga)) continue;
    const esente = ESENTI.find((e) => e.funzione === f.nome && riga.includes(e.contiene));
    if (esente) continue;
    fragili.push({ nome: f.nome, file: f.file, riga: riga.trim() });
  }
}

ok(
  fragili.length === 0,
  fragili.length === 0
    ? `nessuna delle ${scrivono.length} scrive dietro un confronto che con NULL non scatta`
    : fragili.map((g) => `${g.nome} [${g.file}]\n      ${g.riga}\n      → usa «is distinct from»`).join("\n    "),
);

for (const e of ESENTI) {
  if (fn.has(e.funzione)) console.log(`  · esente: ${e.funzione} — ${e.perche.split(".")[0]}.`);
}

// ── controprova ─────────────────────────────────────────────────────────────
// Senza, «zero fragili» direbbe solo che la lista letta era vuota. Le tre
// forme sono quelle vere trovate il 19/09, più quella già corretta in passato.
const PROVE = [
  ["if v_istituzione_id <> public.current_istituzione_id() then", true],
  ["if v_student is null or v_student <> auth.uid() then", true],
  ["if public.current_ruolo() <> 'admin' then", true],
  ["if v_student is null or v_student is distinct from auth.uid() then", false],
  ["if v_istituzione_id is distinct from public.current_istituzione_id() then", false],
  ["if public.current_ha_permesso_staff('x') then", false],
];
let tarature = 0;
for (const [riga, atteso] of PROVE) {
  const visto = FRAGILE.test(riga) && NULLABILI.test(riga);
  if (visto !== atteso) {
    console.error(`  ✗ taratura: «${riga.trim()}» ${atteso ? "doveva" : "non doveva"} essere vista`);
    tarature++;
  }
}
ok(tarature === 0, "…e il controllo distingue la forma fragile da «is distinct from» (6 prove)");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  Una SECURITY DEFINER gira come proprietario: la RLS non fa da rete, e una\n" +
      "  guardia che con NULL non scatta è l'unica cosa fra un estraneo e una\n" +
      "  scrittura. La cura è «is distinct from».\n",
  );
  process.exit(1);
}
console.log("✓ Chi scrive senza passare dalla RLS controlla davvero chi sta chiamando.\n");
