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
  ok(ids(d.daApprovare) === "rev_passato,rev_vicino,rev_lontano", "da approvare: tutti gli in approvazione, di qualunque data, i più vicini in cima", ids(d.daApprovare));
  const forma = d.inProgrammazione.map((g) => `${g.titolo}: ${ids(g.eventi)}`);
  ok(
    JSON.stringify(forma) === JSON.stringify(["Approvati: appr_in_corso,appr_lontano", "sospeso: sospeso"]),
    "in programmazione: gli approvati non finiti, e uno stato sconosciuto in un gruppo col suo nome",
    forma,
  );
  ok(ids(d.passati) === "chiusa_in_anticipo,ieri,mese_scorso", "passati: sulla fine effettiva, dal più recente", ids(d.passati));
  ok(ids(d.rifiutati) === "rif_futuro,rif_vecchio", "rifiutati: di qualunque data, i più recenti in cima", ids(d.rifiutati));
  const tutti = [...d.daApprovare, ...d.inProgrammazione.flatMap((g) => g.eventi), ...d.passati, ...d.rifiutati].map((e) => e.id);
  ok(!tutti.some((i) => i.startsWith("bozza")), "nessuna bozza in nessuna sezione, nemmeno se la lettura le lasciasse passare");
  ok(tutti.length === eventi.length - 2, "ogni evento che non è una bozza sta in una sezione, una volta sola", `${tutti.length} su ${eventi.length - 2}`);
  ok(new Set(tutti).size === tutti.length, "…e nessuno in due");
}

console.log("\n§2 — le frasi\n");
{
  ok(A.etichettaDaApprovare(3) === "Da approvare (3)", "il numero accanto alla voce");
  ok(A.etichettaDaApprovare(0) === "Da approvare (0)", "zero è un numero");
  ok(A.etichettaDaApprovare(null) === "Da approvare", "non letto non è zero: nessun numero");
  ok(A.avvisoDaApprovare(ev("p", { data_inizio: "2026-10-20T10:00:00Z", data_fine: "2026-10-20T11:00:00Z" }), ORA) === "La data di questo incontro è già passata.", "una proposta con la data passata lo dice");
  ok(A.avvisoDaApprovare(ev("f", {}), ORA) === null, "…una futura no");
  ok(A.motivoRifiuto(ev("r", { note_revisione: "  Manca il programma.  " })) === "Nota di revisione: Manca il programma.", "un rifiutato dice la nota che ha ricevuto l'ente");
  ok(A.motivoRifiuto(ev("r", { note_revisione: "   " })) === "Rifiutato senza una nota di revisione.", "…e dice anche quando non ne ha ricevuta nessuna");
}

console.log("\n§3 — i posti\n");
{
  const layout = leggi("app/admin/eventi/layout.tsx");
  const ordine = ["/admin/eventi\"", "/admin/eventi/in-programmazione", "/admin/eventi/passati", "/admin/eventi/rifiutati"].map((h) => layout.indexOf(h));
  ok(ordine.every((i) => i >= 0) && ordine.every((i, k) => k === 0 || i > ordine[k - 1]), "le schede nell'ordine del mestiere: da approvare, in programmazione, passati, rifiutati", ordine);
  ok(/etichettaDaApprovare\(daApprovare\)/.test(layout), "…e «Da approvare» porta il numero");
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
