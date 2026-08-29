// `npm run banco percorso [filtro]` — dove sta ogni percorso workshop.
//
// Sostituisce l'SQL incollato a mano nell'editor di Supabase. Legge via
// PostgREST con la chiave service_role (scavalca la RLS: serve, perché queste
// righe appartengono agli studenti), e stampa la stessa cosa che il 30 agosto
// era una tabella grezza da interpretare: tappa, stato, quanto è passato dalla
// consegna, a che tentativo siamo, com'è finita la revisione, la fiducia.
//
// SOLA LETTURA. Nessuna scrittura passa da qui — vedi `azzera.js` per l'unico
// comando che scrive, che infatti è separato e lo dice.
//
// Il filtro facoltativo è una sottostringa: slug del workshop, slug del ruolo,
// o id dell'iscrizione. Senza filtro mostra tutto.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { config } = require("./config");

async function chiedi(c, percorso) {
  const risposta = await fetch(`${c.supabaseUrl}/rest/v1/${percorso}`, {
    headers: {
      apikey: c.supabaseServiceRoleKey,
      Authorization: `Bearer ${c.supabaseServiceRoleKey}`,
    },
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    console.error(`\n✗ Supabase ha risposto ${risposta.status}:`);
    console.error("  " + testo.slice(0, 400));
    if (risposta.status === 401) {
      console.error("\n  Quasi sempre è la chiave: serve la service_role, non la anon.");
    }
    process.exit(1);
  }
  return risposta.json();
}

// «3 giorni fa» si legge, «2026-08-27T09:14:22Z» va sottratto a mente.
function quantoFa(iso) {
  if (!iso) return "—";
  const minuti = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 48) return `${ore}h ${minuti % 60}m fa`;
  return `${Math.floor(ore / 24)} giorni fa`;
}

const SIMBOLO = { bloccata: "·", aperta: "○", consegnata: "→", revisionata: "✓" };

async function percorso(filtro) {
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);

  const select =
    "select=id,iscrizione_id,fase_id,stato,consegnata_at,revisionata_at,tentativi_revisione,revisione_esito," +
    "workshop_iscrizioni(student_id,workshop(slug,titolo),workshop_ruoli(slug,titolo))" +
    "&order=iscrizione_id,aperta_at";

  const righe = await chiedi(c, `workshop_fasi_stato?${select}`);
  const elaborati = await chiedi(c, "workshop_elaborati?select=iscrizione_id,fiducia,stato");
  const fiducia = new Map(elaborati.map((e) => [e.iscrizione_id, e]));

  // Raggruppate per iscrizione: un percorso si legge tutto insieme, non riga
  // per riga sparse fra altri percorsi.
  const perIscrizione = new Map();
  for (const r of righe) {
    const isc = Array.isArray(r.workshop_iscrizioni) ? r.workshop_iscrizioni[0] : r.workshop_iscrizioni;
    const ws = isc ? (Array.isArray(isc.workshop) ? isc.workshop[0] : isc.workshop) : null;
    const ruolo = isc ? (Array.isArray(isc.workshop_ruoli) ? isc.workshop_ruoli[0] : isc.workshop_ruoli) : null;
    const etichetta = `${ws?.slug ?? "?"} > ${ruolo?.slug ?? "?"}`;
    if (filtro && !`${etichetta} ${r.iscrizione_id}`.toLowerCase().includes(String(filtro).toLowerCase())) continue;
    if (!perIscrizione.has(r.iscrizione_id)) perIscrizione.set(r.iscrizione_id, { etichetta, righe: [] });
    perIscrizione.get(r.iscrizione_id).righe.push(r);
  }

  if (perIscrizione.size === 0) {
    console.log(filtro ? `\nNessun percorso corrisponde a «${filtro}».\n` : "\nNessun percorso workshop avviato.\n");
    return;
  }

  for (const [iscrizioneId, gruppo] of perIscrizione) {
    const e = fiducia.get(iscrizioneId);
    const chiuso = e?.stato === "consegnato" ? "  — PROGETTO CHIUSO" : "";
    console.log(`\n${gruppo.etichetta}   fiducia ${e?.fiducia ?? 0}/100${chiuso}`);
    console.log(`  iscrizione ${iscrizioneId}`);
    for (const r of gruppo.righe) {
      const simbolo = SIMBOLO[r.stato] ?? "?";
      const parti = [`${simbolo} ${r.fase_id.padEnd(22)} ${String(r.stato).padEnd(12)}`];
      if (r.stato === "consegnata") parti.push(`consegnata ${quantoFa(r.consegnata_at)}`);
      if (r.stato === "revisionata") parti.push(`revisionata ${quantoFa(r.revisionata_at)}`);
      if (r.tentativi_revisione) parti.push(`tentativi ${r.tentativi_revisione}`);
      if (r.revisione_esito && r.revisione_esito !== "riuscita") parti.push(`ESITO ${r.revisione_esito}`);
      console.log("    " + parti.join("  "));
    }

    // La riga che il 30 agosto è servita più di tutte: una tappa consegnata e
    // ferma con tentativi già spesi è il caso in cui NON bisogna rilanciare
    // alla cieca.
    const inAttesa = gruppo.righe.find((r) => r.stato === "consegnata");
    if (inAttesa && inAttesa.tentativi_revisione > 0) {
      console.log(`    ⚠  Questa tappa ha già bruciato ${inAttesa.tentativi_revisione} tentativi.`);
      console.log("       Guarda perché prima di rilanciare: npm run banco log");
    }
  }
  console.log("");
}

module.exports = { percorso };
