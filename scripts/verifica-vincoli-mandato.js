// Il vincolo del mandato: quando il motore ne ricava una cifra, quella cifra
// deve essere quella che il vincolo annuncia.
//
// DA DOVE VIENE QUESTO CONTROLLO. Il 27/09 Mario ha notato che i vincoli dei
// mandati annunciano numeri che il motore non usa — «dodici giorni per la
// sostituzione» del quadro elettrico, «+19.000 €» dell'impianto idrico — e ha
// posto la domanda giusta: se vale per tutte le missioni è una scelta, se vale
// solo per alcune è una divergenza. Misurato: **è una divergenza**, e il
// censimento qui sotto la stampa a ogni esecuzione. Una missione su undici
// (`progetto-quartiere`) cabla il vincolo nel calcolo; le altre dieci no.
//
// MA LÀ DOVE IL CABLAGGIO C'È, LA CIFRA È SCRITTA DUE VOLTE: una nella prosa del
// vincolo («dei 180.000 € ne restano 141.000») e una nel motore (`totale: (m) =>
// m?.vincolo.id === "budget" ? 141000 : 180000`). Due copie della stessa
// affermazione, in due punti che nessuno legge insieme — e la seconda è quella
// che conta, perché è quella che lo studente subisce. Se qualcuno ritocca la
// prosa a 150.000 il tetto resta 141.000 e niente lo dice.
//
// Quindi la proprietà, e vale per qualunque missione futura che decida di
// cablare un vincolo: **ogni cifra che il motore ricava dal mandato compare nel
// testo del vincolo di quel mandato.** Si scopre confrontando i mandati fra loro
// (il tetto che cambia, la voce che appare solo per uno) invece di elencare a
// mano i casi noti: un cablaggio nuovo entra da sé nel controllo.
//
// COSA QUESTO NON FA, dichiarato: non pretende che i vincoli siano cablati. Se
// dieci missioni su undici annunciano grandezze che il motore ignora, è una cosa
// da decidere, non un test da far diventare rosso — e la decisione è di Mario.
// Qui il censimento la rende visibile, e basta.
//
// Nessuna chiamata AI, nessuna rete: si costruisce la missione reale dal config.
//
// Esecuzione: `npm run test:vincoli`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { abilitaTypeScript } = require("./banco/ts");
abilitaTypeScript();

const E = require("@/lib/escape/config");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
  return cond;
};

// Il separatore delle migliaia come lo scrive la prosa italiana: 141000 →
// «141.000». `toLocaleString("it-IT")` non lo mette sui numeri di quattro cifre.
const conPunti = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// Una cifra può comparire nel testo con o senza separatore («34.000», «4000»):
// si accettano entrambe le forme, perché la proprietà è sul NUMERO, non su come
// è scritto.
const compare = (testo, n) => testo.includes(conPunti(n)) || testo.includes(String(n));

// GRANDEZZE, non «numeri»: una cifra o un numerale seguiti da un'unità. «un
// caso», «tre volte» non sono grandezze del motore, e contarle gonfierebbe il
// censimento nella direzione che fa comodo a chi lo legge.
const UNITA = "€|euro|%|giorni|giorno|mesi|mese|settimane|settimana|ore|ora|minuti|punti|cent|centesimi|abitanti|posti|litri|kW";
const NUMERALE = "due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|quindici|venti|trenta";
const GRANDEZZA = new RegExp(`(?:\\d[\\d.,]*\\s*(?:mila|${UNITA}))|(?:(?:${NUMERALE})\\s+(?:${UNITA}))`, "gi");

// Il passo 3.1 costruito con un mandato scelto e nient'altro.
const budgetCon = (slug, mandatoId) => {
  const get = (id) => (id === "s1_mandato" ? { opzioneId: mandatoId } : undefined);
  return E.stepDellaMissione(E.getMissione(slug, get)).find((s) => s.id === "s3_budget");
};

// ── 1) Censimento: dove il mandato entra nel calcolo, e dove è prosa ──────────
console.log("\n1) Il mandato entra nel calcolo del passo 3.1?");

const missioni = [];
for (const meta of E.MISSIONI) {
  const def = E.getMissioneDef(meta.slug);
  const per = def.mandati.map((m) => ({ mandato: m, budget: budgetCon(meta.slug, m.id) }));
  const firme = new Set(
    per.map(({ budget: b }) =>
      b.tipo === "alloca_budget"
        ? `A|${b.totale}|${b.voci.map((v) => v.id).join(",")}`
        : `P|${b.budgetSoldi}|${b.budgetGiorni}|${b.obiettivo}|${b.lavori.map((l) => l.id).join(",")}`,
    ),
  );
  // `.match()` e non `.test()`: GRANDEZZA ha il flag `g`, e `.test()` su una regex
  // globale avanza `lastIndex` — quindi in un ciclo salterebbe delle righe e il
  // censimento conterebbe MENO grandezze di quante ce ne sono. Un conteggio che
  // sbaglia verso il basso è la risposta comoda: farebbe sembrare la divergenza
  // più piccola di quello che è.
  const conGrandezza = per.filter(({ mandato }) => mandato.vincolo.testo.match(GRANDEZZA) !== null).length;
  missioni.push({ slug: meta.slug, per, cablata: firme.size > 1, conGrandezza });
}

const cablate = missioni.filter((m) => m.cablata);
const prosa = missioni.filter((m) => !m.cablata);
for (const m of cablate) console.log(`   ${m.slug.padEnd(22)} CABLATA — il mandato cambia i tetti o le voci   (vincoli con una grandezza: ${m.conGrandezza}/${m.per.length})`);
for (const m of prosa) console.log(`   ${m.slug.padEnd(22)} prosa — il mandato non tocca il calcolo         (vincoli con una grandezza: ${m.conGrandezza}/${m.per.length})`);

const totMandati = missioni.reduce((s, m) => s + m.per.length, 0);
const totGrandezze = missioni.reduce((s, m) => s + m.conGrandezza, 0);
const grandezzeNelleProse = prosa.reduce((s, m) => s + m.conGrandezza, 0);
console.log(
  `\n   ${cablate.length} missioni su ${missioni.length} cablano il vincolo. Su ${totMandati} mandati, ${totGrandezze} annunciano una grandezza,\n` +
    `   e ${grandezzeNelleProse} di quelle stanno in una missione che non le usa: è la divergenza, e non la decide questo controllo.`,
);
// Non un'asserzione sulla divergenza, ma una sul CENSIMENTO: se smettesse di
// leggere i mandati, tutto sarebbe «prosa» e nessuno lo saprebbe.
ok(totMandati > 0 && totGrandezze > 0, `il censimento ha letto ${totMandati} mandati e ne ha trovati ${totGrandezze} che annunciano una grandezza`);

// ── 2) Dove il cablaggio c'è, la cifra è quella che il vincolo annuncia ───────
console.log("\n2) Le cifre cablate compaiono nel testo del vincolo che le annuncia");

let cifreControllate = 0;
for (const m of cablate) {
  // (a) IL TETTO CHE CAMBIA. Il valore che vale per la maggioranza dei mandati è
  //     quello «normale»; ogni scostamento è un cablaggio, e il suo numero deve
  //     stare nella prosa di quel mandato.
  const conteggio = new Map();
  for (const { budget: b } of m.per) {
    const t = b.tipo === "alloca_budget" ? b.totale : b.budgetSoldi;
    if (t === undefined) continue;
    conteggio.set(t, (conteggio.get(t) ?? 0) + 1);
  }
  const normale = [...conteggio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const { mandato, budget: b } of m.per) {
    const t = b.tipo === "alloca_budget" ? b.totale : b.budgetSoldi;
    if (t === undefined || t === normale) continue;
    cifreControllate++;
    ok(
      compare(mandato.vincolo.testo, t),
      compare(mandato.vincolo.testo, t)
        ? `${m.slug} · ${mandato.id}: il tetto scende a ${conPunti(t)} e il vincolo lo dice`
        : `${m.slug} · ${mandato.id}: il motore porta il tetto a ${conPunti(t)} e il vincolo non nomina quel numero → «${mandato.vincolo.testo}»`,
    );
  }

  // (b) LA VOCE CHE ESISTE SOLO PER UN MANDATO. È il costo dell'adeguamento
  //     imposto dal vincolo: annunciato nella prosa e riscritto nel motore.
  const quantiHanno = new Map();
  for (const { budget: b } of m.per) {
    const ids = b.tipo === "alloca_budget" ? b.voci.map((v) => v.id) : b.lavori.map((l) => l.id);
    for (const id of new Set(ids)) quantiHanno.set(id, (quantiHanno.get(id) ?? 0) + 1);
  }
  for (const { mandato, budget: b } of m.per) {
    const proprie = b.tipo === "alloca_budget" ? b.voci : b.lavori;
    for (const voce of proprie) {
      if ((quantiHanno.get(voce.id) ?? 0) >= m.per.length) continue; // c'è per tutti: non viene dal mandato
      const costo = voce.costoIndicativo ?? voce.costo;
      if (typeof costo !== "number" || costo === 0) continue;
      cifreControllate++;
      ok(
        compare(mandato.vincolo.testo, costo),
        compare(mandato.vincolo.testo, costo)
          ? `${m.slug} · ${mandato.id}: la voce «${voce.id}» costa ${conPunti(costo)} e il vincolo lo dice`
          : `${m.slug} · ${mandato.id}: la voce «${voce.id}» costa ${conPunti(costo)} nel motore e il vincolo non nomina quel numero → «${mandato.vincolo.testo}»`,
      );
    }
  }
}
ok(cifreControllate > 0, `le cifre cablate trovate confrontando i mandati fra loro sono ${cifreControllate}: il controllo ha qualcosa da guardare`);

// ── 3) Controprove: il controllo si accorge davvero ──────────────────────────
// Senza, «tutto verde» direbbe soltanto che nessuna cifra è stata trovata.
console.log("\n3) Controprove");

// Il confronto è sul NUMERO, non su come è scritto: una cifra sotto le mille
// compare senza separatore, e un controllo che cercasse solo la forma puntata
// griderebbe su un testo giusto.
ok(compare("costa 4.000 € in più", 4000) && compare("costa 4000 € in più", 4000), "una cifra si riconosce sia puntata sia nuda");
ok(!compare("dei 180.000 € ne restano 141.000.", 150000), "…e un numero che nel testo non c'è non viene riconosciuto");

// Il filtro delle grandezze: «un caso» non è una grandezza, «dodici giorni» sì.
const g = (t) => (t.match(GRANDEZZA) ?? []).length > 0;
ok(g("+38.000 € e uno dei tre locali") && g("dodici giorni per la sostituzione"), "il filtro riconosce una grandezza");
ok(!g("serve un piano firmato o l'assegnazione decade") && !g("tre ingressi"), "…e non conta «un piano» né «tre ingressi» come grandezze del motore");

// LA TRAPPOLA CHE IL CENSIMENTO HA AVUTO PER PRIMA, e che non si vede rileggendo:
// `GRANDEZZA` porta il flag `g`, e `.test()` su una regex globale avanza
// `lastIndex` — in un ciclo salta delle righe. Costava 5 grandezze su 26, tutte
// nella direzione che fa sembrare la divergenza più piccola.
const tre = ["+38.000 € e uno dei tre locali", "dodici giorni per la sostituzione", "40 minuti a testa"];
ok(tre.filter((t) => t.match(GRANDEZZA) !== null).length === 3, "con `.match()` il conteggio vede tutte e tre le righe");
const conTest = tre.filter((t) => GRANDEZZA.test(t)).length;
ok(conTest < 3, `…e con .test() su una regex globale ne conterebbe ${conTest} su 3: è il motivo per cui il censimento non lo usa`);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  Una cifra che il motore ricava dal mandato e che il vincolo non annuncia è\n" +
      "  un gioco che dice una cosa e conta un'altra: la differenza la paga chi ha\n" +
      "  letto meglio. Si allinea la prosa al motore, o il motore alla prosa —\n" +
      "  ma le due copie non possono divergere in silenzio.\n",
  );
  process.exit(1);
}
console.log("✓ Le cifre che il motore ricava dai mandati sono quelle che i vincoli annunciano.\n");
