// `npm run banco iscrizioni` — chi sta facendo cosa nei workshop.
//
// PERCHÉ ESISTE, E PERCHÉ NON SI CHIAMA PIÙ «posti». Il 30 agosto 2026 questo
// comando si chiamava `posti` e contava quanti ne restassero liberi: un ruolo
// poteva farlo un solo studente al mondo, quindi la piattaforma aveva
// venticinque posti IN ASSOLUTO. Quel vincolo è uscito lo stesso giorno —
// nessuno l'aveva mai deciso, e il commento che lo accompagnava diceva di
// volere un'altra cosa (la guardia contro la doppia iscrizione della stessa
// persona, non l'esclusività del ruolo).
//
// Adesso nessuno è bloccato da nessuno, quindi qui non c'è più niente da
// contare come scarsità: resta un'informazione, cioè quanti stanno facendo
// cosa. Il nome è cambiato perché un comando che si chiama «posti» fa credere
// che ci sia una coda.
//
// Sola lettura.

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

const uno = (v) => (Array.isArray(v) ? v[0] : v);

async function iscrizioni() {
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);

  const ruoli = await chiedi(c, "workshop_ruoli?select=id,slug,workshop(slug)&order=workshop_id,ordine");
  const righe = await chiedi(
    c,
    "workshop_iscrizioni?select=id,ruolo_id,stato,created_at,student_id,workshop_elaborati(stato),profiles!student_id(nome,cognome,di_prova)",
  );

  const perRuolo = new Map();
  for (const i of righe) {
    if (!perRuolo.has(i.ruolo_id)) perRuolo.set(i.ruolo_id, []);
    perRuolo.get(i.ruolo_id).push(i);
  }

  const perWorkshop = new Map();
  for (const r of ruoli) {
    const slug = uno(r.workshop)?.slug ?? "?";
    if (!perWorkshop.has(slug)) perWorkshop.set(slug, []);
    perWorkshop.get(slug).push({ ...r, righe: perRuolo.get(r.id) ?? [] });
  }

  const totali = { attivo: 0, completato: 0, ritirato: 0, diProva: 0 };
  const daSistemare = []; // attive su un progetto già chiuso

  console.log("");
  for (const [slug, elenco] of perWorkshop) {
    console.log(`── ${slug}`);
    for (const r of elenco) {
      const conta = { attivo: 0, completato: 0, ritirato: 0 };
      for (const i of r.righe) conta[i.stato] = (conta[i.stato] ?? 0) + 1;
      totali.attivo += conta.attivo;
      totali.completato += conta.completato;
      totali.ritirato += conta.ritirato;

      const riassunto =
        r.righe.length === 0
          ? "nessuno"
          : [
              conta.attivo ? `${conta.attivo} in corso` : null,
              conta.completato ? `${conta.completato} finiti` : null,
              conta.ritirato ? `${conta.ritirato} lasciati` : null,
            ]
              .filter(Boolean)
              .join(", ");
      console.log(`   ${r.slug.padEnd(16)} ${riassunto}`);

      for (const i of r.righe) {
        const p = uno(i.profiles);
        if (p?.di_prova) totali.diProva++;
        if (i.stato === "attivo" && uno(i.workshop_elaborati)?.stato === "consegnato") {
          daSistemare.push({ id: i.id, chi: `${p?.nome ?? "?"} ${p?.cognome ?? ""}`.trim(), dove: `${slug} > ${r.slug}` });
        }
      }
    }
  }

  console.log("");
  console.log(`  in corso: ${totali.attivo}   ·   finiti: ${totali.completato}   ·   lasciati: ${totali.ritirato}`);
  if (totali.diProva > 0) console.log(`  (${totali.diProva} di profili DI PROVA)`);
  console.log("");
  console.log("  Nessuno è in coda: un ruolo lo possono fare quanti vogliono.");
  console.log("  L'unico vincolo è una sola iscrizione in corso per studente e workshop.");

  if (daSistemare.length > 0) {
    console.log("");
    console.log(`  ⚠  ${daSistemare.length} iscrizioni dicono «in corso» ma il progetto è chiuso.`);
    console.log("     Sono di prima del 2026-08-30, quando il completamento non esisteva: il");
    console.log("     cron le chiude solo da adesso in avanti, all'ultima tappa. Per sistemare");
    console.log("     quelle vecchie, una volta sola, dal SQL Editor:");
    console.log("");
    console.log("       update public.workshop_iscrizioni i set stato = 'completato'");
    console.log("       from public.workshop_elaborati e");
    console.log("       where e.iscrizione_id = i.id and e.stato = 'consegnato' and i.stato = 'attivo'");
    console.log("       returning i.id, i.stato;");
    console.log("");
    for (const d of daSistemare) console.log(`     · ${d.dove} — ${d.chi}`);
  }
  console.log("");
}

module.exports = { iscrizioni };
