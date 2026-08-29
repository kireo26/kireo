// `npm run banco posti` — quanti posti restano nei workshop, davvero.
//
// PERCHÉ ESISTE. Il 2026-08-30 il robot si è fermato al primo gesto, sul
// vincolo `workshop_iscrizioni_ruolo_attivo_idx`: un ruolo, uno studente
// attivo. Il vincolo è una scelta giusta; quello che nessuno aveva contato è
// che **non esiste nessun percorso, in tutta l'interfaccia, che porti
// un'iscrizione da `attivo` a `completato` o `ritirato`** — nemmeno finire il
// progetto. Quindi un ruolo preso non si libera mai, e i posti della
// piattaforma sono venticinque in assoluto, non venticinque per volta.
//
// Questo comando dice il numero. Sola lettura.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { config } = require("./config");

async function chiedi(c, percorso) {
  const risposta = await fetch(`${c.supabaseUrl}/rest/v1/${percorso}`, {
    headers: { apikey: c.supabaseServiceRoleKey, Authorization: `Bearer ${c.supabaseServiceRoleKey}` },
  });
  if (!risposta.ok) {
    console.error(`\n✗ Supabase ha risposto ${risposta.status}: ${(await risposta.text()).slice(0, 300)}\n`);
    process.exit(1);
  }
  return risposta.json();
}

async function posti() {
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);

  const ruoli = await chiedi(c, "workshop_ruoli?select=id,slug,workshop(slug,titolo)&order=workshop_id,ordine");
  const iscrizioni = await chiedi(
    c,
    "workshop_iscrizioni?select=id,ruolo_id,stato,created_at,student_id,workshop_elaborati(stato),profiles!student_id(nome,cognome,di_prova)",
  );

  const perRuolo = new Map();
  for (const i of iscrizioni) {
    if (!perRuolo.has(i.ruolo_id)) perRuolo.set(i.ruolo_id, []);
    perRuolo.get(i.ruolo_id).push(i);
  }

  const perWorkshop = new Map();
  for (const r of ruoli) {
    const ws = Array.isArray(r.workshop) ? r.workshop[0] : r.workshop;
    const slug = ws?.slug ?? "?";
    if (!perWorkshop.has(slug)) perWorkshop.set(slug, []);
    perWorkshop.get(slug).push({ ...r, iscrizioni: perRuolo.get(r.id) ?? [] });
  }

  let occupati = 0;
  let liberi = 0;
  let occupatiDaProva = 0;
  let occupatiDaProgettoChiuso = 0;

  console.log("");
  for (const [slug, elenco] of perWorkshop) {
    console.log(`── ${slug}`);
    for (const r of elenco) {
      const attive = r.iscrizioni.filter((i) => i.stato === "attivo");
      if (attive.length === 0) {
        liberi++;
        console.log(`   libero      ${r.slug}`);
        continue;
      }
      occupati++;
      for (const i of attive) {
        const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
        const el = Array.isArray(i.workshop_elaborati) ? i.workshop_elaborati[0] : i.workshop_elaborati;
        const chiuso = el?.stato === "consegnato";
        if (p?.di_prova) occupatiDaProva++;
        if (chiuso) occupatiDaProgettoChiuso++;
        const chi = `${p?.nome ?? "?"} ${p?.cognome ?? ""}`.trim();
        const note = [p?.di_prova ? "profilo di prova" : null, chiuso ? "PROGETTO GIÀ CHIUSO" : null].filter(Boolean).join(", ");
        console.log(`   OCCUPATO    ${r.slug.padEnd(16)} ${chi}${note ? `   (${note})` : ""}   dal ${String(i.created_at).slice(0, 10)}`);
      }
      // Un ruolo con più di un'iscrizione attiva non dovrebbe esistere:
      // l'indice unico parziale lo impedisce. Se compare, il vincolo non c'è.
      if (attive.length > 1) console.log(`   ⚠  ${attive.length} iscrizioni ATTIVE sullo stesso ruolo: l'indice unico non sta reggendo`);
    }
  }

  const totale = occupati + liberi;
  console.log("");
  console.log("═══════════ IL CONTO ═══════════\n");
  console.log(`  posti totali nella piattaforma:  ${totale}`);
  console.log(`  occupati:                        ${occupati}`);
  console.log(`  liberi:                          ${liberi}`);
  console.log("");
  if (occupatiDaProva > 0) console.log(`  · di quelli occupati, ${occupatiDaProva} da profili DI PROVA`);
  if (occupatiDaProgettoChiuso > 0) {
    console.log(`  · e ${occupatiDaProgettoChiuso} da progetti GIÀ CHIUSI, che in un mondo con il`);
    console.log(`    completamento sarebbero già liberi`);
  }
  console.log("");
  console.log("  Finché un'iscrizione non può passare da «attivo» a «completato» o");
  console.log("  «ritirato», questi posti non tornano: sono venticinque IN ASSOLUTO,");
  console.log("  non venticinque per volta. Una classe li esaurisce tutti.");
  console.log("");
}

module.exports = { posti };
