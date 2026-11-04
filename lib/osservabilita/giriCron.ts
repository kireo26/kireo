// I GIRI DEI CRON E LA MAIL DEL LUNEDÌ (04/11, 20261209110000).
//
// Decisione di Mario: la mail dell'osservabilità resta muta nei giorni sani, e
// il lunedì parte comunque, con l'ultima volta che ogni cron ha girato. Un giro
// saltato o in ritardo si vede dalla DATA, non dall'assenza: la sola assenza di
// una mail non si distingue da un giorno sano.
//
// ⚠️ Il limite resta quello del 04/11: la mail la manda il cron dei workshop, e
// se quel cron non gira non parte neanche il lunedì. Quello che cambia è che
// una settimana intera senza la mail del lunedì è un'assenza che si nota,
// perché ogni lunedì ce n'è una.

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { registraGuasto } from "@/lib/guasti/registra";
import { descriviErrore } from "@/lib/erroreSupabase";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { giornoItaliano } from "@/lib/newsletter/regole";

/** I cron che la mail del lunedì guarda, e quanti giri programmati ci si aspetta al giorno. */
export const CRON_ATTESI: { processo: string; nome: string; alGiorno: number }[] = [
  { processo: "cron/workshop-motore", nome: "Motore dei workshop e osservabilità (7:00)", alGiorno: 1 },
  { processo: "cron/newsletter", nome: "Newsletter degli enti (6:30 e 7:30)", alGiorno: 2 },
  { processo: "cron/registrazioni", nome: "Sonda delle registrazioni (5:17)", alGiorno: 1 },
];

export const GIORNI_GUARDATI = 7;

/** Il lunedì in ora italiana (il cron parte alle 6 UTC, cioè le 7 o le 8 a Roma). */
export function eLunedìARoma(adesso: Date): boolean {
  return new Date(`${giornoItaliano(adesso)}T12:00:00Z`).getUTCDay() === 1;
}

const giornoRoma = (d: Date) => giornoItaliano(d);
const oraRoma = (d: Date) => formattaDataOra(d, "medium");

type ClienteGiri = ReturnType<typeof createServiceRoleClient>;

/** Segna l'inizio di un giro. Non ferma mai il cron: se non riesce, è un guasto e si va avanti. */
export async function segnaGiroIniziato(processo: string, programmato: boolean): Promise<{ id: string; supabase: ClienteGiri } | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("giri_cron").insert({ processo, programmato }).select("id").single();
    if (error || !data) {
      console.error(`[${processo}] giro non segnato:`, descriviErrore(error));
      await registraGuasto({ processo, specie: "giro_cron", motivo: "inizio", dettaglio: error });
      return null;
    }
    return { id: data.id as string, supabase };
  } catch (e) {
    console.error(`[${processo}] giro non segnato:`, descriviErrore(e));
    await registraGuasto({ processo, specie: "giro_cron", motivo: "inizio", dettaglio: e });
    return null;
  }
}

/** Segna la fine di un giro, contando la riga toccata: zero righe non è «finito». */
export async function segnaGiroFinito(giro: { id: string; supabase: ClienteGiri } | null, processo: string): Promise<void> {
  if (!giro) return;
  const { data, error } = await giro.supabase.from("giri_cron").update({ finito_il: new Date().toISOString() }).eq("id", giro.id).select("id");
  if (error || !data || data.length !== 1) {
    console.error(`[${processo}] fine del giro non segnata:`, descriviErrore(error));
    await registraGuasto({ processo, specie: "giro_cron", motivo: "fine", dettaglio: error ?? { righe: data?.length ?? 0 } });
  }
}

export type RigaGiro = { processo: string; partito_il: string; finito_il: string | null };

export type RiassuntoGiri = {
  processo: string;
  nome: string;
  ultimo: { partito: Date; finito: boolean } | null;
  giri: number;
  attesi: number;
  giorniSenza: string[]; // giorni (AAAA-MM-GG, ora italiana) senza nessun giro programmato
  nonFiniti: number;
};

/** Pura: dalle righe programmate degli ultimi giorni, una riga per cron. */
export function riassumiGiri(righe: RigaGiro[], adesso: Date): RiassuntoGiri[] {
  const giorni: string[] = [];
  for (let i = GIORNI_GUARDATI; i >= 1; i--) giorni.push(giornoRoma(new Date(adesso.getTime() - i * 86_400_000)));
  return CRON_ATTESI.map(({ processo, nome, alGiorno }) => {
    const sue = righe
      .filter((r) => r.processo === processo)
      .map((r) => ({ partito: new Date(r.partito_il), finito: r.finito_il !== null }))
      .filter((r) => Number.isFinite(r.partito.getTime()))
      .sort((a, b) => b.partito.getTime() - a.partito.getTime());
    const nellaFinestra = sue.filter((r) => giorni.includes(giornoRoma(r.partito)));
    const coperti = new Set(nellaFinestra.map((r) => giornoRoma(r.partito)));
    return {
      processo,
      nome,
      ultimo: sue[0] ?? null,
      giri: nellaFinestra.length,
      attesi: alGiorno * GIORNI_GUARDATI,
      giorniSenza: giorni.filter((g) => !coperti.has(g)),
      nonFiniti: nellaFinestra.filter((r) => !r.finito).length,
    };
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const giornoLeggibile = (g: string) => formattaData(`${g}T12:00:00Z`, "medium");

/** Il blocco della mail del lunedì. `null` = non letto, e lo dice. Testi miei e provvisori. */
export function testoGiri(riassunto: RiassuntoGiri[] | null): string {
  if (riassunto === null)
    return `<p><strong>Giri dei cron</strong> — Non siamo riusciti a leggere i giri dei cron: questo non vuol dire che abbiano girato.</p>`;
  const righe = riassunto
    .map((r) => {
      const ultimo = r.ultimo
        ? `ultimo giro ${esc(oraRoma(r.ultimo.partito))}${r.ultimo.finito ? "" : " (partito e non finito)"}`
        : "nessun giro registrato";
      const conto = `giri negli ultimi ${GIORNI_GUARDATI} giorni: ${r.giri} su ${r.attesi} attesi`;
      const senza = r.giorniSenza.length > 0 ? ` · ⚠️ giorni senza nessun giro: ${r.giorniSenza.map(giornoLeggibile).join(", ")}` : "";
      const rotti = r.nonFiniti > 0 ? ` · ⚠️ partiti e non finiti: ${r.nonFiniti}` : "";
      return `<li>${esc(r.nome)} — ${ultimo}; ${conto}${senza}${rotti}</li>`;
    })
    .join("");
  return `<p><strong>Giri dei cron</strong> (contati dal 4 novembre 2026, quando abbiamo cominciato a scriverli):</p><ul>${righe}</ul>`;
}

/** C'è qualcosa da segnalare nei giri? Un giorno senza giro o un giro non finito. */
export function giriDaSegnalare(riassunto: RiassuntoGiri[] | null): boolean {
  return riassunto === null || riassunto.some((r) => r.giorniSenza.length > 0 || r.nonFiniti > 0);
}

/** Legge le righe programmate dei giorni guardati, e pota quelle oltre i 60 giorni. */
// `giroCorrente` è il giro di chi sta scrivendo la mail: è partito e non ancora
// finito per costruzione, e senza questa eccezione ogni lunedì direbbe
// «partito e non finito» di sé stesso.
export async function leggiGiri(supabase: ClienteGiri, adesso: Date, giroCorrente: string | null): Promise<RiassuntoGiri[] | null> {
  const dal = new Date(adesso.getTime() - (GIORNI_GUARDATI + 1) * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("giri_cron")
    .select("id, processo, partito_il, finito_il")
    .eq("programmato", true)
    .gte("partito_il", dal)
    .order("partito_il", { ascending: false })
    .limit(500);
  if (error || !Array.isArray(data)) {
    console.error("[lib/osservabilita/giriCron.ts] giri non letti:", descriviErrore(error));
    await registraGuasto({ processo: "cron/workshop-motore", specie: "giro_cron", motivo: "lettura", dettaglio: error });
    return null;
  }
  const { error: erroreTaglio } = await supabase
    .from("giri_cron")
    .delete()
    .lt("partito_il", new Date(adesso.getTime() - 60 * 86_400_000).toISOString());
  if (erroreTaglio) console.error("[lib/osservabilita/giriCron.ts] potatura non riuscita:", descriviErrore(erroreTaglio));
  const righe = (data as (RigaGiro & { id: string })[]).map((r) =>
    r.id === giroCorrente ? { ...r, finito_il: r.finito_il ?? adesso.toISOString() } : r,
  );
  return riassumiGiri(righe, adesso);
}
