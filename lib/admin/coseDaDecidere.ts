// COSA ASPETTA UNA DECISIONE DELL'ADMIN (Mario, 31/10). Una fonte sola: la
// leggono la prima schermata («Oggi») e la cima di «Notifiche». Se domani
// nasce un'ottava cosa da decidere, si aggiunge QUI e compare in tutte e due
// senza che nessuno se ne ricordi. *Due schermate che contano la stessa cosa,
// prima o poi, contano diverso; e il giorno che succede, l'amministratore
// crede a quella che ha davanti.*
//
// ⚠️ UN CONTEGGIO CHE FALLISCE NON DICE ZERO. Ogni voce ha `numero: null` se
// la sua lettura non è riuscita, e la schermata lo dice: una pagina delle cose
// da fare che dice «niente» quando non ha letto è la cosa peggiore che possa
// fare, perché dice a Mario che non c'è niente da fare.
//
// ⚠️ I POST E LE AREE NON CI SONO, e non è una dimenticanza: non si approvano
// (i post si pubblicano subito, le aree le sceglie l'ente). Nel flusso di
// «Notifiche» stanno come «è successo», non come «aspetta te».
//
// I CRITERI stanno qui una volta sola, e li usano anche le pagine dove si
// decide (`CRITERI.*.filtra`), così il numero e l'elenco non possono dire due
// cose diverse. Per gli eventi il criterio è `dividiEventiAdmin`, e per le
// email `avvisiDaRiprovare`: già una regola sola, qui si chiama e non si
// riscrive.

import type { SupabaseClient } from "@supabase/supabase-js";
import { contaDaApprovare } from "@/lib/admin/caricaEventiAdmin";
import { avvisiDaRiprovare, type RigaAvviso } from "@/lib/admin/avvisiEnte";

type Filtrabile = {
  eq: (c: string, v: unknown) => Filtrabile;
  in: (c: string, v: unknown[]) => Filtrabile;
};

export const CRITERI = {
  istituzioniInAttesa: { tabella: "istituzioni", filtra: <Q,>(q: Q): Q => (q as unknown as Filtrabile).eq("stato", "in_attesa") as unknown as Q },
  newsletterDaApprovare: { tabella: "newsletter_enti", filtra: <Q,>(q: Q): Q => (q as unknown as Filtrabile).eq("stato", "in_approvazione") as unknown as Q },
  upgradeInAttesa: { tabella: "richieste_upgrade", filtra: <Q,>(q: Q): Q => (q as unknown as Filtrabile).eq("stato", "in_attesa") as unknown as Q },
  scuoleInAttesa: { tabella: "scuole_profili", filtra: <Q,>(q: Q): Q => (q as unknown as Filtrabile).in("stato", ["richiesta", "convenzionata"]) as unknown as Q },
  contattiDaGestire: { tabella: "richieste_contatto", filtra: <Q,>(q: Q): Q => (q as unknown as Filtrabile).eq("gestita", false) as unknown as Q },
} as const;

export type CosaDaDecidere = {
  chiave: string;
  etichetta: string;
  /** null = la lettura non è riuscita: NON è zero. */
  numero: number | null;
  href: string;
};

// L'ordine è quello di chi deve muoversi per primo: chi aspetta di entrare,
// poi chi aspetta una risposta su una cosa che ha scritto, poi la macchina.
// Testi miei e provvisori.
const VOCI: { chiave: string; etichetta: string; href: string }[] = [
  { chiave: "istituzioni", etichetta: "Enti in attesa di attivazione", href: "/admin/enti?stato=in_attesa" },
  { chiave: "scuole", etichetta: "Scuole in attesa di attivazione", href: "/admin/scuole#in-attesa" },
  { chiave: "eventi", etichetta: "Eventi da approvare", href: "/admin/eventi/da-approvare" },
  { chiave: "newsletter", etichetta: "Newsletter da approvare", href: "/admin/newsletter/da-approvare" },
  { chiave: "upgrade", etichetta: "Richieste di cambio piano", href: "/admin/enti?stato=cambio_piano" },
  { chiave: "contatti", etichetta: "Richieste di contatto da gestire", href: "/admin/notifiche#contatti" },
  { chiave: "email", etichetta: "Email all'ente non partite", href: "/admin/sistema#email" },
];

async function conta(supabase: SupabaseClient, criterio: { tabella: string; filtra: <Q>(q: Q) => Q }): Promise<number | null> {
  try {
    const q = supabase.from(criterio.tabella).select("id", { count: "exact", head: true });
    const { count, error } = await criterio.filtra(q);
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * Le email all'ente non partite: la decisione la cui ULTIMA riga non è
 * partita. La stessa lettura per «Oggi» e per «Sistema». `null` = non letto.
 */
export async function leggiAvvisiDaRiprovare(supabase: SupabaseClient): Promise<RigaAvviso[] | null> {
  try {
    const { data, error } = await supabase
      .from("avvisi_email_enti")
      .select("cosa, riferimento_id, esito, motivo, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !Array.isArray(data)) return null;
    return avvisiDaRiprovare(data as RigaAvviso[]);
  } catch {
    return null;
  }
}

export async function coseDaDecidere(supabase: SupabaseClient): Promise<CosaDaDecidere[]> {
  const [istituzioni, scuole, eventi, newsletter, upgrade, contatti, email] = await Promise.all([
    conta(supabase, CRITERI.istituzioniInAttesa),
    conta(supabase, CRITERI.scuoleInAttesa),
    contaDaApprovare(supabase).catch(() => null),
    conta(supabase, CRITERI.newsletterDaApprovare),
    conta(supabase, CRITERI.upgradeInAttesa),
    conta(supabase, CRITERI.contattiDaGestire),
    leggiAvvisiDaRiprovare(supabase).then((r) => (r === null ? null : r.length)),
  ]);
  const numeri: Record<string, number | null> = { istituzioni, scuole, eventi, newsletter, upgrade, contatti, email };
  return VOCI.map((v) => ({ ...v, numero: numeri[v.chiave] ?? null }));
}

export const TESTI_COSE_DA_DECIDERE = {
  titolo: "Cosa aspetta te",
  nonLetto: "non letto",
  nonLettoSpiegazione: "Dove c'è scritto «non letto» non siamo riusciti a contare: non vuol dire zero. Ricarica la pagina.",
  tuttoFatto: "Niente da decidere, adesso.",
};
