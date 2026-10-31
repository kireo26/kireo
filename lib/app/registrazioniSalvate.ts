// LE REGISTRAZIONI SALVATE (Mario, 31/10, 20261124100000). Stanno in «Le mie
// cose» con le guide e i post. La ragione di Mario: l'Agenda mostra solo gli
// ultimi 20 eventi passati, e una registrazione si perde scorrendo.
//
// ⚠️ LA RIGA È DIVISA IN DUE, ed è la decisione:
//   · l'IDENTITÀ (titolo, ente, data, video) è quella copiata dal database al
//     momento del gesto: resta anche se l'evento sparisce;
//   · DOVE SI GUARDA si calcola ogni volta dalle colonne VIVE dell'evento, con
//     la stessa regola della card (`doveSiRivede`). Un evento risondato cambia
//     il bottone anche qui, perché lo stato si legge e non si copia. Non si
//     scrive mai `dove` in una colonna.
//
// ⚠️ SALVARE NON È ESSERCI: niente presenza, niente ore, e queste righe NON
// entrano in «Le mie attività» (che racconta quello che lo studente ha fatto,
// non quello che ha messo da parte).

import type { SupabaseClient } from "@supabase/supabase-js";
import { formattaData } from "@/lib/formato";
import { doveSiRivede, type DoveSiRivede } from "@/lib/eventi/registrazione";

export type RegistrazioneSalvata = {
  salvataggioId: string;
  eventoId: string | null;
  titolo: string;
  enteNome: string;
  istituzioneSlug: string | null;
  dataEvento: string;
  /** Il video com'era al gesto: è identità, non dove si guarda. */
  videoId: string;
  /** Il video di adesso, quello a cui portano i bottoni (l'admin può averlo cambiato). */
  videoAdesso: string | null;
  salvataIl: string;
  /** Dove si guarda adesso: calcolato, mai copiato. */
  dove: DoveSiRivede;
  /** Perché non si guarda, quando `dove` è null. */
  perche: "evento_sparito" | "video_sparito" | "non_verificabile" | null;
};

type Rpc = {
  rpc: (fn: "registrazioni_salvate_mie") => PromiseLike<{ data: unknown; error: unknown }>;
};

const testo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Dove si guarda una riga, dalle sue colonne vive. Pura, provata da sola. */
export function doveSiGuardaRiga(
  r: {
    evento_visibile: boolean;
    tipo: string | null;
    data_inizio: string | null;
    data_fine: string | null;
    diretta_chiusa_il: string | null;
    youtube_video_id: string | null;
    registrazione_esito: string | null;
  },
  adesso: Date = new Date(),
): Pick<RegistrazioneSalvata, "dove" | "perche"> {
  if (!r.evento_visibile || !r.tipo || !r.data_inizio) return { dove: null, perche: "evento_sparito" };
  const dove = doveSiRivede(
    {
      tipo: r.tipo,
      data_inizio: r.data_inizio,
      data_fine: r.data_fine,
      diretta_chiusa_il: r.diretta_chiusa_il,
      youtube_video_id: r.youtube_video_id,
      registrazione_esito: r.registrazione_esito,
    },
    adesso,
  );
  if (dove) return { dove, perche: null };
  return { dove: null, perche: r.registrazione_esito === "non_trovata" ? "video_sparito" : "non_verificabile" };
}

/**
 * Le righe di chi chiede. `null` vuol dire NON LETTO (errore, o una riga che
 * non ha la forma attesa): non è «non hai salvato niente».
 */
export async function leggiRegistrazioniSalvate(supabase: Rpc, adesso: Date = new Date()): Promise<RegistrazioneSalvata[] | null> {
  try {
    const { data, error } = await supabase.rpc("registrazioni_salvate_mie");
    if (error || !Array.isArray(data)) return null;
    const righe: RegistrazioneSalvata[] = [];
    for (const r of data as Record<string, unknown>[]) {
      if (
        typeof r?.salvataggio_id !== "string" || typeof r.titolo_evento !== "string" || typeof r.ente_nome !== "string" ||
        typeof r.data_evento !== "string" || typeof r.video_id !== "string" || typeof r.salvata_il !== "string" ||
        typeof r.evento_visibile !== "boolean"
      ) {
        return null;
      }
      righe.push({
        salvataggioId: r.salvataggio_id,
        eventoId: testo(r.evento_id),
        titolo: r.titolo_evento,
        enteNome: r.ente_nome,
        istituzioneSlug: testo(r.istituzione_slug),
        dataEvento: r.data_evento,
        videoId: r.video_id,
        videoAdesso: testo(r.youtube_video_id),
        salvataIl: r.salvata_il,
        ...doveSiGuardaRiga(
          {
            evento_visibile: r.evento_visibile,
            tipo: testo(r.tipo),
            data_inizio: testo(r.data_inizio),
            data_fine: testo(r.data_fine),
            diretta_chiusa_il: testo(r.diretta_chiusa_il),
            youtube_video_id: testo(r.youtube_video_id),
            registrazione_esito: testo(r.registrazione_esito),
          },
          adesso,
        ),
      });
    }
    return righe;
  } catch {
    return null;
  }
}

// ── CHI PUÒ SALVARE, SU UNA PAGINA CON DELLE CARD ─────────────────────────────
// Quattro casi, e nessuno è un ripiego dell'altro: chi non ha fatto l'accesso
// legge che serve l'accesso (non un bottone che poi fallisce); chi non è uno
// studente non vede niente (il database glielo rifiuterebbe); una lettura
// fallita non afferma niente; gli altri vedono «Salva» o «Salvata ✓».
export type SalvataggiRegistrazioni =
  | { tipo: "senza_accesso" }
  | { tipo: "non_studente" }
  | { tipo: "non_letto" }
  | { tipo: "letto"; salvate: ReadonlySet<string> };

type Lettore = {
  from: (t: "registrazioni_salvate") => {
    select: (c: "evento_id") => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

export async function leggiSalvataggiRegistrazioni(
  supabase: Lettore | SupabaseClient,
  utente: { id: string; ruolo: string | null } | null,
): Promise<SalvataggiRegistrazioni> {
  if (!utente) return { tipo: "senza_accesso" };
  if (utente.ruolo !== "studente") return { tipo: "non_studente" };
  try {
    const { data, error } = await (supabase as Lettore).from("registrazioni_salvate").select("evento_id");
    if (error || !Array.isArray(data)) return { tipo: "non_letto" };
    const salvate = new Set<string>();
    for (const r of data as { evento_id?: unknown }[]) if (typeof r?.evento_id === "string") salvate.add(r.evento_id);
    return { tipo: "letto", salvate };
  } catch {
    return { tipo: "non_letto" };
  }
}

/**
 * Per una pagina che ha solo l'id dell'utente: legge il ruolo e poi i
 * salvataggi. Un ruolo che non si legge è «non letto», non «non studente».
 */
export async function salvataggiDi(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<SalvataggiRegistrazioni> {
  if (!userId) return { tipo: "senza_accesso" };
  try {
    const { data, error } = await supabase.from("profiles").select("ruolo").eq("id", userId).maybeSingle();
    if (error) return { tipo: "non_letto" };
    const ruolo = (data as { ruolo?: unknown } | null)?.ruolo;
    return leggiSalvataggiRegistrazioni(supabase, { id: userId, ruolo: typeof ruolo === "string" ? ruolo : null });
  } catch {
    return { tipo: "non_letto" };
  }
}

/** Lo stato del bottone per un evento: null = niente da mostrare. */
export function statoSalva(s: SalvataggiRegistrazioni, eventoId: string): "accedi" | "salva" | "salvata" | null {
  if (s.tipo === "senza_accesso") return "accedi";
  if (s.tipo === "letto") return s.salvate.has(eventoId) ? "salvata" : "salva";
  return null;
}

// Testi miei e provvisori (31/10), tranne `nonConta` che resta quello di Mario
// (`TESTI_RIVEDI.nonConta`).
export const TESTI_REGISTRAZIONI_SALVATE = {
  salva: "Salva la registrazione",
  salvata: "Salvata ✓ — Togli",
  salvataDove: "La ritrovi in Le mie cose.",
  accedi: "Per salvare la registrazione serve l'accesso.",
  accediLink: "Accedi",
  nonRiuscito: "Non è stato possibile salvarla. Riprova.",
  nonRivedibile: "Questa registrazione non si può più guardare, quindi non si può salvare.",
  togliNonRiuscito: "Non è stato possibile toglierla. Riprova.",
  togli: "Non salvarla più",
  riga: (r: RegistrazioneSalvata) =>
    `${r.enteNome} · diretta del ${formattaData(r.dataEvento, "long")} · salvata il ${formattaData(r.salvataIl, "long")}`,
  /** Perché non c'è un bottone: una riga per caso, mai il silenzio. */
  perche: {
    evento_sparito: "L'incontro non è più su KIREO: qui resta quello che avevi salvato.",
    video_sparito: "Il video non c'è più su YouTube: l'ente l'ha tolto o reso privato.",
    non_verificabile: "In questo momento non riusciamo a verificare la registrazione. Riprova più tardi.",
  } as const,
};
