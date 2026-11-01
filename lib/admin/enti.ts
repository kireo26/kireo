// GLI ENTI NELL'AREA ADMIN (lotto 2 del riordino, Mario, 01/11).
//
// L'ELENCO: in ordine alfabetico, cercato per nome, filtrato per stato, con il
// totale scritto e quanti ne mostra. Una lettura che fallisce si dice, non
// diventa un elenco vuoto.
//
// LA PAGINA DI UN ENTE: chi è, le aree con la revoca, il piano con i cambi,
// cosa pubblica, i suoi numeri, le conversazioni, e il flusso ristretto a lui.
// Le quattro sezioni provvisorie del 31/10 (attivazioni, aree, conversazioni,
// cambi di piano) ci sono entrate tutte: niente è sparito. Quelle che erano
// elenchi di tutti gli enti sono diventate due filtri dell'elenco («Cambio di
// piano da decidere», «Conversazione segnalata»), così il colpo d'occhio su
// tutti resta.
//
// Testi miei e provvisori.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERI } from "@/lib/admin/coseDaDecidere";
import { descriviErrore } from "@/lib/erroreSupabase";

export const FILTRI_ENTI = [
  { chiave: "tutti", label: "Tutti" },
  { chiave: "in_attesa", label: "In attesa di attivazione" },
  { chiave: "attiva", label: "Attivi" },
  { chiave: "sospesa", label: "Sospesi" },
  { chiave: "cambio_piano", label: "Cambio di piano da decidere" },
  { chiave: "segnalati", label: "Con una conversazione segnalata" },
] as const;
export type FiltroEnti = (typeof FILTRI_ENTI)[number]["chiave"];

/** Un valore sconosciuto è «Tutti»: un filtro storto non svuota l'elenco. */
export function filtroDa(v: string | undefined): FiltroEnti {
  return (FILTRI_ENTI.find((f) => f.chiave === v)?.chiave ?? "tutti") as FiltroEnti;
}

export function hrefFiltro(filtro: FiltroEnti, q?: string): string {
  const s = new URLSearchParams();
  if (filtro !== "tutti") s.set("stato", filtro);
  if (q) s.set("q", q);
  const qs = s.toString();
  return qs ? `/admin/enti?${qs}` : "/admin/enti";
}

export const ETICHETTA_STATO_ENTE: Record<string, string> = {
  in_attesa: "In attesa di attivazione",
  attiva: "Attivo",
  sospesa: "Sospeso",
};

export const ETICHETTA_TIPO_ENTE: Record<string, string> = {
  universita: "Università",
  its: "ITS Academy",
  academy: "Accademia",
  ente_professionale: "Ente professionale",
  altro: "Altro",
};

/**
 * Gli id degli enti per i due filtri che guardano un'altra tabella. `null` =
 * la lettura non è riuscita (l'elenco lo dice, non mostra «nessuno»).
 * I criteri sono quelli di «Oggi»: il numero e l'elenco non possono dire due
 * cose diverse.
 */
export async function idEntiPerFiltro(supabase: SupabaseClient, filtro: FiltroEnti): Promise<string[] | null | undefined> {
  if (filtro === "cambio_piano") {
    const { data, error } = await CRITERI.upgradeInAttesa.filtra(supabase.from("richieste_upgrade").select("istituzione_id"));
    if (error) {
      console.error("[admin] enti con un cambio di piano:", descriviErrore(error));
      return null;
    }
    return [...new Set((data ?? []).map((r) => r.istituzione_id as string))];
  }
  if (filtro === "segnalati") {
    const { data, error } = await supabase.from("conversazioni_enti").select("istituzione_id").eq("stato", "bloccata_da_studente");
    if (error) {
      console.error("[admin] enti con una conversazione segnalata:", descriviErrore(error));
      return null;
    }
    return [...new Set((data ?? []).map((r) => r.istituzione_id as string))];
  }
  return undefined;
}

export type SchedaAdminEnte = {
  seguaciStudenti: number;
  seguaciAltri: number;
  account: { nome: string | null; cognome: string | null; email: string | null; dal: string | null }[];
};

/** Il jsonb di `scheda_admin_ente`, o null se manca un pezzo: mai zeri inventati. */
export function leggiScheda(dato: unknown): SchedaAdminEnte | null {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) return null;
  const o = dato as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const studenti = n(o.seguaci_studenti);
  const altri = n(o.seguaci_altri);
  if (studenti === undefined || altri === undefined || !Array.isArray(o.account)) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    seguaciStudenti: studenti,
    seguaciAltri: altri,
    account: o.account.map((a) => {
      const r = (a ?? {}) as Record<string, unknown>;
      return { nome: s(r.nome), cognome: s(r.cognome), email: s(r.email), dal: s(r.dal) };
    }),
  };
}

/** Chi segue l'ente, diviso: «Segui» è aperto a chiunque sia collegato. */
export function testoSeguaci(s: SchedaAdminEnte): string {
  return s.seguaciAltri > 0
    ? `Studenti che lo seguono: ${s.seguaciStudenti} · altri account: ${s.seguaciAltri}`
    : `Studenti che lo seguono: ${s.seguaciStudenti}`;
}

/**
 * La riga di un ente in attesa: chi ha chiesto di entrare, con l'email, perché
 * dall'elenco si attiva senza aprire la pagina. Mai «nessun account» per una
 * lettura fallita.
 */
export function testoAccountInAttesa(s: SchedaAdminEnte | null): string {
  if (!s) return "Non siamo riusciti a leggere l'account che ha chiesto di entrare: apri la pagina dell'ente prima di attivarlo.";
  if (s.account.length === 0) return "Nessun account è collegato a questo ente.";
  return `Account: ${s.account.map((a) => a.email ?? "email non letta").join(", ")}`;
}

export const TESTI_ENTI_ADMIN = {
  ricerca: "Cerca per nome dell'ente",
  nonLetti: "Non siamo riusciti a leggere gli enti: ricarica la pagina.",
  filtroNonLetto: "Non siamo riusciti a leggere quali enti stanno in questo filtro: ricarica la pagina.",
  nessuno: "Nessun ente con questi criteri.",
  cambioPiano: "Cambio di piano da decidere",
  schedaNonLetta: "Non siamo riusciti a leggere chi segue l'ente e i suoi account: ricarica la pagina.",
  statisticheNonLette: "Non siamo riusciti a leggere i numeri dell'ente: ricarica la pagina.",
  nessunAccount: "Nessun account è collegato a questo ente.",
  // Le conversazioni si chiudono da qui, ma non si leggono: se l'admin debba
  // leggere i messaggi fra uno studente e un ente è una decisione di Mario
  // ancora aperta (`messaggi_enti_admin_tutto`, nei punti aperti), e una
  // schermata che li mostrasse la prenderebbe al posto suo.
  conversazioniNota: "Qui si vede lo stato di ogni conversazione e la si può chiudere. I messaggi non si leggono da qui.",
} as const;
