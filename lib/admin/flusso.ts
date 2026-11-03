// IL FLUSSO DI «NOTIFICHE» (Mario, 31/10): tutto quello che è successo in
// piattaforma negli ultimi 30 giorni, per gruppo. Non esiste un registro di
// «cosa è successo»: il flusso si compone leggendo le tabelle che ci sono.
// *Un registro di tutto è una cosa grossa, e si fa quando serve a qualcosa che
// comporre non può dare.*
//
// ⚠️ OGNI RIGA PORTA SOLO LE DATE CHE LA TABELLA SA DIMOSTRARE. Una
// newsletter dice quando è stata scritta e, se c'è, quando è stata approvata;
// non dice quando è stata mandata in approvazione, perché quella data non
// esiste. *Un dato che per entrare in una tabella deve essere inventato non ci
// entra.* Le decisioni dell'admin su newsletter e upgrade non lasciano una
// storia (lo stato si sovrascrive): è nei punti aperti, e si costruisce il
// giorno in cui serve rispondere a «chi ha approvato questo e quando».
//
// ⚠️ LA FINESTRA SI DICE: ogni gruppo scrive quante righe ha negli ultimi 30
// giorni, ne mostra le ultime 10 e porta all'elenco intero. Una lettura che
// fallisce è «non letta», mai un gruppo vuoto.

import type { SupabaseClient } from "@supabase/supabase-js";
import { inizioFinestraAdmin } from "@/lib/admin/menu";
import { descriviErrore } from "@/lib/erroreSupabase";
import { parolaDelloStato } from "@/lib/stati/parole";

export const RIGHE_PER_GRUPPO = 10;

export type RigaFlusso = { id: string; testo: string; date: { etichetta: string; quando: string }[] };
export type GruppoFlusso = {
  chiave: string;
  titolo: string;
  href: string;
  /** null = la lettura non è riuscita. */
  totale: number | null;
  righe: RigaFlusso[];
};

type Definizione = {
  chiave: string;
  titolo: string;
  href: string;
  tabella: string;
  colonne: string;
  /** La colonna che decide se una riga sta nella finestra. */
  data: string;
  /**
   * La colonna che dice di quale ente è la riga: serve al flusso ristretto a un
   * ente (la sua pagina nell'admin). Un gruppo senza questa colonna non ha
   * niente di un ente, e nel flusso ristretto non compare.
   */
  colonnaEnte?: string;
  filtro?: (q: Filtrabile) => Filtrabile;
  riga: (r: Record<string, unknown>) => RigaFlusso;
};
type Filtrabile = { neq: (c: string, v: unknown) => Filtrabile; not: (c: string, o: string, v: unknown) => Filtrabile; eq: (c: string, v: unknown) => Filtrabile };

const nomeDi = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return (x as { nome?: string } | null)?.nome ?? "—";
};
const testo = (v: unknown) => (typeof v === "string" ? v : "");
const data = (etichetta: string, v: unknown) => (typeof v === "string" && v ? [{ etichetta, quando: v }] : []);

// Testi miei e provvisori.
export const DEFINIZIONI: Definizione[] = [
  {
    chiave: "eventi",
    titolo: "Eventi proposti",
    href: "/admin/eventi",
    tabella: "eventi",
    colonne: "id, titolo, stato, created_at, istituzioni(nome)",
    data: "created_at",
    colonnaEnte: "organizzatore_id",
    filtro: (q) => q.neq("stato", "bozza"),
    riga: (r) => ({ id: testo(r.id), testo: `${nomeDi(r.istituzioni)} · ${testo(r.titolo)} · ${parolaDelloStato("eventi.stato", testo(r.stato)).toLowerCase()}`, date: data("proposto il", r.created_at) }),
  },
  {
    chiave: "post",
    titolo: "Post pubblicati",
    href: "/admin/post",
    tabella: "post_enti",
    colonne: "id, corpo, stato, created_at, istituzioni(nome)",
    data: "created_at",
    colonnaEnte: "istituzione_id",
    riga: (r) => ({ id: testo(r.id), testo: `${nomeDi(r.istituzioni)} · ${testo(r.corpo).slice(0, 80)}`, date: data("pubblicato il", r.created_at) }),
  },
  {
    chiave: "post_tolti",
    titolo: "Post tolti dal feed",
    href: "/admin/post/tolti",
    tabella: "post_enti",
    colonne: "id, corpo, tolto_il, istituzioni(nome)",
    data: "tolto_il",
    colonnaEnte: "istituzione_id",
    riga: (r) => ({ id: testo(r.id), testo: `${nomeDi(r.istituzioni)} · ${testo(r.corpo).slice(0, 80)}`, date: data("tolto il", r.tolto_il) }),
  },
  {
    chiave: "newsletter",
    titolo: "Newsletter scritte",
    href: "/admin/newsletter",
    tabella: "newsletter_enti",
    colonne: "id, oggetto, stato, created_at, approvata_il, istituzioni(nome)",
    data: "created_at",
    colonnaEnte: "istituzione_id",
    filtro: (q) => q.neq("stato", "bozza"),
    riga: (r) => ({
      id: testo(r.id),
      testo: `${nomeDi(r.istituzioni)} · ${testo(r.oggetto)} · ${parolaDelloStato("newsletter_enti.stato", testo(r.stato)).toLowerCase()}`,
      date: [...data("scritta il", r.created_at), ...data("approvata il", r.approvata_il)],
    }),
  },
  {
    chiave: "messaggi_scuola",
    titolo: "Messaggi delle scuole agli studenti",
    href: "/admin/scuole#messaggi",
    tabella: "messaggi_scuola",
    colonne: "id, oggetto, destinatari, created_at",
    data: "created_at",
    riga: (r) => ({ id: testo(r.id), testo: `${testo(r.oggetto)} · ${testo(r.destinatari)}`, date: data("mandato il", r.created_at) }),
  },
  {
    chiave: "enti",
    titolo: "Enti registrati",
    href: "/admin/enti",
    tabella: "istituzioni",
    colonne: "id, nome, stato, created_at",
    data: "created_at",
    colonnaEnte: "id",
    riga: (r) => ({ id: testo(r.id), testo: `${testo(r.nome)} · ${parolaDelloStato("istituzioni.stato", testo(r.stato)).toLowerCase()}`, date: data("registrato il", r.created_at) }),
  },
  {
    chiave: "scuole",
    titolo: "Scuole che hanno chiesto di aderire",
    href: "/admin/scuole",
    tabella: "scuole_profili",
    colonne: "id, scuola_id, stato, created_at, convenzione_firmata_il",
    data: "created_at",
    riga: (r) => ({
      id: testo(r.id),
      testo: `${testo(r.scuola_id)} · ${parolaDelloStato("scuole_profili.stato", testo(r.stato)).toLowerCase()}`,
      date: [...data("richiesta il", r.created_at), ...data("convenzione il", r.convenzione_firmata_il)],
    }),
  },
  {
    chiave: "upgrade",
    titolo: "Richieste di cambio piano",
    href: "/admin/enti?stato=cambio_piano",
    tabella: "richieste_upgrade",
    colonne: "id, stato, created_at, istituzioni(nome)",
    data: "created_at",
    colonnaEnte: "istituzione_id",
    riga: (r) => ({ id: testo(r.id), testo: `${nomeDi(r.istituzioni)} · ${parolaDelloStato("richieste_upgrade.stato", testo(r.stato)).toLowerCase()}`, date: data("richiesta il", r.created_at) }),
  },
];

// `istituzioneId`: il flusso ristretto a un ente (la sua pagina nell'admin).
// Restano i soli gruppi che hanno la colonna dell'ente, filtrati su di lui.
export async function leggiFlusso(supabase: SupabaseClient, adesso: Date = new Date(), istituzioneId?: string): Promise<GruppoFlusso[]> {
  const dal = inizioFinestraAdmin(adesso);
  const definizioni = istituzioneId ? DEFINIZIONI.filter((d) => d.colonnaEnte) : DEFINIZIONI;
  return Promise.all(
    definizioni.map(async (d) => {
      try {
        let q = supabase.from(d.tabella).select(d.colonne, { count: "exact" }).gte(d.data, dal) as unknown as Filtrabile;
        if (d.filtro) q = d.filtro(q);
        if (istituzioneId && d.colonnaEnte) q = q.eq(d.colonnaEnte, istituzioneId);
        const { data: righe, count, error } = await (q as unknown as {
          order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; count: number | null; error: unknown }> };
        })
          .order(d.data, { ascending: false })
          .limit(RIGHE_PER_GRUPPO);
        if (error || !Array.isArray(righe) || typeof count !== "number") {
          if (error) console.error(`[admin] flusso ${d.chiave}:`, descriviErrore(error));
          return { chiave: d.chiave, titolo: d.titolo, href: d.href, totale: null, righe: [] };
        }
        return { chiave: d.chiave, titolo: d.titolo, href: d.href, totale: count, righe: (righe as Record<string, unknown>[]).map(d.riga) };
      } catch {
        return { chiave: d.chiave, titolo: d.titolo, href: d.href, totale: null, righe: [] };
      }
    }),
  );
}
