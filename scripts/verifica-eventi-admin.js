#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA PAGINA EVENTI DELL'ADMIN (Mario, 27/10): la forma di quella dell'ente,
// l'ordine del mestiere dell'admin — Da approvare (N) → In programmazione →
// Eventi passati → Rifiutati —, il nome dell'ente su ogni riga, e niente bozze.
//
// Le funzioni pure si CHIAMANO, con gli attesi scritti a mano; i file si
// leggono solo per le proprietà di posto (l'ordine delle schede, dove sta la
// plancia, che la lettura escluda le bozze).
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const A = require("@/lib/admin/eventiAdmin");

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
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));

const ORA = new Date("2026-10-27T10:00:00Z");
const ev = (id, o) => ({
  id, titolo: id, tipo: "webinar", data_inizio: "2026-11-01T10:00:00Z", data_fine: "2026-11-01T11:00:00Z",
  stato: "approvato", pubblico: "studenti", filone: null, diretta_chiusa_il: null, diretta_chiusa_presenti: null,
  ente: "Ente X", note_revisione: null, ...o,
});
const ids = (l) => l.map((e) => e.id).join(",");

console.log("\n§1 — le quattro sezioni, e le bozze da nessuna parte\n");
{
  const eventi = [
    ev("rev_lontano", { stato: "in_approvazione", data_inizio: "2026-12-01T10:00:00Z", data_fine: "2026-12-01T11:00:00Z" }),
    ev("rev_vicino", { stato: "in_approvazione", data_inizio: "2026-10-28T10:00:00Z", data_fine: "2026-10-28T11:00:00Z" }),
    ev("rev_passato", { stato: "in_approvazione", data_inizio: "2026-10-20T10:00:00Z", data_fine: "2026-10-20T11:00:00Z" }),
    ev("appr_lontano", { data_inizio: "2026-12-10T10:00:00Z", data_fine: "2026-12-10T11:00:00Z" }),
    ev("appr_in_corso", { data_inizio: "2026-10-27T09:30:00Z", data_fine: "2026-10-27T10:30:00Z" }),
    ev("chiusa_in_anticipo", { data_inizio: "2026-10-27T09:00:00Z", data_fine: "2026-10-27T11:00:00Z", diretta_chiusa_il: "2026-10-27T09:50:00Z" }),
    ev("ieri", { data_inizio: "2026-10-26T10:00:00Z", data_fine: "2026-10-26T11:00:00Z" }),
    ev("mese_scorso", { data_inizio: "2026-09-26T10:00:00Z", data_fine: "2026-09-26T11:00:00Z" }),
    ev("rif_vecchio", { stato: "rifiutato", data_inizio: "2026-09-02T10:00:00Z", data_fine: "2026-09-02T11:00:00Z", note_revisione: "  Manca il programma.  " }),
    ev("rif_futuro", { stato: "rifiutato", data_inizio: "2026-11-02T10:00:00Z", data_fine: "2026-11-02T11:00:00Z" }),
    ev("bozza_futura", { stato: "bozza" }),
    ev("bozza_passata", { stato: "bozza", data_inizio: "2026-09-01T10:00:00Z", data_fine: "2026-09-01T11:00:00Z" }),
    ev("sospeso", { stato: "sospeso" }),
  ];
  const d = A.dividiEventiAdmin(eventi, ORA);
  // Gli attesi sono scritti a mano.
  // ⚠️ Dal 27/10 una proposta con la data già passata non è lavoro (Mario):
  // esce da «Da approvare», e quindi dal numero, e va in un gruppo suo.
  ok(ids(d.daApprovare) === "rev_vicino,rev_lontano", "da approvare: solo gli in approvazione che si possono ancora far accadere, i più vicini in cima", ids(d.daApprovare));
  ok(ids(d.scaduti) === "rev_passato", "…e quelli con la data passata in un gruppo loro", ids(d.scaduti));
  const forma = d.inProgrammazione.map((g) => `${g.titolo}: ${ids(g.eventi)}`);
  ok(
    JSON.stringify(forma) === JSON.stringify(["Approvati: appr_in_corso,appr_lontano", "sospeso: sospeso"]),
    "in programmazione: gli approvati non finiti, e uno stato sconosciuto in un gruppo col suo nome",
    forma,
  );
  ok(ids(d.passati) === "chiusa_in_anticipo,ieri,mese_scorso", "passati: sulla fine effettiva, dal più recente", ids(d.passati));
  ok(ids(d.rifiutati) === "rif_futuro,rif_vecchio", "rifiutati: di qualunque data, i più recenti in cima", ids(d.rifiutati));
  const tutti = [...d.daApprovare, ...d.scaduti, ...d.inProgrammazione.flatMap((g) => g.eventi), ...d.passati, ...d.rifiutati].map((e) => e.id);
  ok(!tutti.some((i) => i.startsWith("bozza")), "nessuna bozza in nessuna sezione, nemmeno se la lettura le lasciasse passare");
  ok(tutti.length === eventi.length - 2, "ogni evento che non è una bozza sta in una sezione, una volta sola", `${tutti.length} su ${eventi.length - 2}`);
  ok(new Set(tutti).size === tutti.length, "…e nessuno in due");
}

console.log("\n§2 — le frasi\n");
{
  ok(A.etichettaDaApprovare(3) === "Da approvare (3)", "il numero accanto alla voce");
  ok(A.etichettaDaApprovare(0) === "Da approvare (0)", "zero è un numero");
  ok(A.etichettaDaApprovare(null) === "Da approvare", "non letto non è zero: nessun numero");
  ok(A.AVVISO_SCADUTO === "La data di questo incontro è già passata: approvarlo non lo fa più accadere.", "il gruppo delle scadute dice perché sta lì");
  ok(A.motivoRifiuto(ev("r", { note_revisione: "  Manca il programma.  " })) === "Nota di revisione: Manca il programma.", "un rifiutato dice la nota che ha ricevuto l'ente");
  ok(A.motivoRifiuto(ev("r", { note_revisione: "   " })) === "Rifiutato senza una nota di revisione.", "…e dice anche quando non ne ha ricevuta nessuna");
}

console.log("\n§2bis — un rifiuto porta la sua ragione\n");
{
  const R = require("@/lib/admin/rifiuto");
  ok(R.erroreRifiuto("") !== null && R.erroreRifiuto("   \n ") !== null, "senza nota (o solo spazi) non si rifiuta");
  ok(R.erroreRifiuto("Manca il programma.") === null, "…con una nota sì");
  // L'USO, non solo la regola (il modo 10): tutti e due i componenti che
  // rifiutano la chiamano, e PRIMA di scrivere — un controllo dopo l'update
  // direbbe «manca la nota» su un rifiuto già partito.
  for (const [f, apertura] of [
    ["components/admin/AzioneApprovazione.tsx", /async function handleAzione\(/],
    ["components/admin/AzioneApprovazionePost.tsx", /async function rifiuta\(\)/],
  ]) {
    const src = leggi(f);
    const da = src.search(apertura);
    const corpo = da >= 0 ? src.slice(da) : "";
    const controllo = corpo.search(/erroreRifiuto\(/);
    const scrittura = corpo.search(/\.update\(/);
    ok(da >= 0 && controllo >= 0 && scrittura > controllo, `${f}: il rifiuto chiede la nota prima di scrivere`, `controllo ${controllo}, scrittura ${scrittura}`);
    ok(!/facoltativ[ao], visibile all'ente/.test(src), `${f}: il campo non dice più «facoltativo»`);
  }
  // E la nota arriva a chi deve leggerla: senza, un rifiuto con la ragione
  // resta muto uguale.
  ok(/note_revisione/.test(leggi("lib/ente/eventiEnte.ts").match(/COLONNE_EVENTO_ENTE =[\s\S]*?;/)?.[0] ?? ""), "l'elenco dell'ente legge la nota");
  ok(/esito=\{motivoRifiuto\(e\)\}/.test(leggi("app/ente/(dashboard)/eventi/page.tsx")), "…e la mostra sotto ogni rifiutato");
  ok(/note_revisione/.test(leggi("lib/eventi/moderazione.ts")) && /motivoRifiuto\(evento\)/.test(leggi("app/diretta/[id]/page.tsx")), "…e così la pagina dell'evento");
  ok(A.motivoRifiuto === require("@/lib/ente/eventiEnte").motivoRifiuto, "la frase è una sola per l'ente e per l'admin");
}

console.log("\n§3 — i posti\n");
{
  const layout = leggi("app/admin/eventi/layout.tsx");
  const ordine = ["/admin/eventi\"", "/admin/eventi/in-programmazione", "/admin/eventi/passati", "/admin/eventi/rifiutati"].map((h) => layout.indexOf(h));
  ok(ordine.every((i) => i >= 0) && ordine.every((i, k) => k === 0 || i > ordine[k - 1]), "le schede nell'ordine del mestiere: da approvare, in programmazione, passati, rifiutati", ordine);
  ok(/etichettaDaApprovare\(daApprovare\)/.test(layout), "…e «Da approvare» porta il numero");
  ok(/dividiEventiAdmin\(eventi\)\.daApprovare\.length/.test(leggi("lib/admin/caricaEventiAdmin.ts")), "…e il numero esce dalla stessa divisione della scheda, non da un conto a parte");
  ok(/\.neq\("stato", "bozza"\)/.test(leggi("lib/admin/caricaEventiAdmin.ts")), "la lettura esclude le bozze nel database, non solo a schermo");
  const elenco = leggi("app/admin/eventi/ElencoAdmin.tsx");
  ok(/ente=\{e\.ente\}/.test(elenco), "ogni riga porta il nome dell'ente");
  const riga = leggi("components/ente/RigaEventoEnte.tsx");
  ok(!/\?\? ETICHETTA_STATO\.bozza/.test(riga), "uno stato sconosciuto non si mostra come «Bozza»");
  const admin = leggi("app/admin/page.tsx");
  ok(!/<AzioneApprovazione tabella="eventi"/.test(admin) && !/<ControlloDirettaEvento/.test(admin), "la coda di /admin non ha più plance di eventi: approvazione e console stanno nella pagina dell'evento");
  const plancia = leggi("components/admin/PlanciaAdminEvento.tsx");
  ok(/evento\.stato === "in_approvazione"/.test(plancia) && /<AzioneApprovazione tabella="eventi"/.test(plancia), "la pagina dell'evento ha approva/rifiuta, solo per un evento in approvazione");
  ok(/evento\.descrizione/.test(plancia), "…con la descrizione intera, su cui si decide");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
