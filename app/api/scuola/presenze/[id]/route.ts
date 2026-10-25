import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generaCsvSezioni } from "@/lib/csv";
import {
  INTESTAZIONE_DISTANZA,
  INTESTAZIONE_ESITO,
  INTESTAZIONE_MINUTI_CONTATI,
  certificataDaPerExport,
  esitoPresenzaPerExport,
  INTESTAZIONE_ORE_RICONOSCIUTE,
  oreRiconosciutePerExport,
  istantePerExport,
  minutiContatiPerExport,
  minutiPerExport,
  notaFinestra,
  notaMinuti,
} from "@/lib/eventi/exportPresenze";
import { descriviErrore } from "@/lib/erroreSupabase";
import { rifiutoExport } from "@/lib/eventi/rifiutoExport";

// Referente/tutor con permesso certificazione_presenze, solo i propri
// studenti verificati (garantito dalla RPC esporta_presenze_scuola,
// SECURITY DEFINER, scoped a current_scuola_id()). Nessun controllo di
// ruolo esplicito qui oltre l'autenticazione: la RPC stessa nega
// (non_autorizzato) a chiunque non sia staff con quel permesso.
//
// ⚠️⚠️ FINO ALL'11/10/2026 QUESTA ROUTE DICEVA UNA COSA FALSA E NON LASCIAVA
// NESSUNA TRACCIA. Qualunque errore della RPC — compreso un difetto nostro —
// diventava un 403 «Non è stato possibile generare l'export», cioè «non hai il
// permesso»: e per tre mesi il difetto c'è stato per davvero
// (`esporta_presenze_scuola` sollevava SEMPRE per un tipo disallineato, vedi
// `20261011130000`). Nessun `console.error`, quindi nessuno poteva saperlo —
// questa route non l'aveva mai premuta nessuno.
//
// Adesso le due cause hanno due risposte: un rifiuto della guardia resta un
// 403, tutto il resto è un 500 nostro e lascia la riga nel log.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  const [{ data: righe, error }, { data: evento, error: erroreEvento }] = await Promise.all([
    supabase.rpc("esporta_presenze_scuola", { p_evento_id: id }),
    // `data_fine` serve a dire «non calcolabile» invece di lasciare vuota la
    // cella dei minuti (vedi `lib/eventi/exportPresenze.ts`), e il titolo a
    // dire di quale incontro sono queste righe.
    supabase.from("eventi").select("titolo, data_inizio, data_fine, diretta_chiusa_il").eq("id", id).maybeSingle(),
  ]);
  if (error) {
    const rifiuto = rifiutoExport(error);
    if (rifiuto.nostro) console.error("Errore esporta_presenze_scuola:", descriviErrore(error));
    return NextResponse.json({ errore: rifiuto.testo }, { status: rifiuto.stato });
  }
  // Se l'evento non si legge, non sappiamo se i minuti vuoti sono «non c'era» o
  // «non calcolabile»: e scegliere a caso sarebbe stampare una delle due bugie.
  // È un guasto nostro — la RPC lo ha appena letto per noi.
  if (erroreEvento || !evento) {
    if (erroreEvento) console.error("Errore lettura evento (export scuola):", descriviErrore(erroreEvento));
    else console.error("Errore lettura evento (export scuola): nessuna riga per", id);
    const rifiuto = rifiutoExport(erroreEvento ?? new Error("evento non leggibile"));
    return NextResponse.json({ errore: rifiuto.testo }, { status: rifiuto.stato });
  }

  const intestazioni = [
    "Nome",
    "Cognome",
    "Email",
    "Classe",
    "Primo ingresso (ora italiana)",
    "Ultima presenza (ora italiana)",
    INTESTAZIONE_MINUTI_CONTATI,
    INTESTAZIONE_DISTANZA,
    "Copertura %",
    INTESTAZIONE_ESITO,
    INTESTAZIONE_ORE_RICONOSCIUTE,
    "Certificata da",
    "Certificata da (nome)",
  ];

  type Riga = {
    nome: string;
    cognome: string;
    email: string | null;
    classe_nome: string | null;
    primo_ping: string | null;
    ultimo_ping: string | null;
    minuti_presenza: number | null;
    minuti_contati?: number | null;
    copertura_percento: number | null;
    stato_finale: string;
    certificata_da_tipo: string | null;
    certificata_da_nome: string | null;
    ore_riconosciute?: number | string | null;
  };
  const elenco = (righe ?? []) as Riga[];
  const corpo = elenco.map((r) => [
    r.nome,
    r.cognome,
    r.email,
    r.classe_nome,
    istantePerExport(r.primo_ping),
    istantePerExport(r.ultimo_ping),
    minutiContatiPerExport(r),
    minutiPerExport(r),
    r.copertura_percento,
    esitoPresenzaPerExport(r, Boolean(evento.diretta_chiusa_il)),
    oreRiconosciutePerExport(r, Boolean(evento.diretta_chiusa_il)),
    certificataDaPerExport(r.certificata_da_tipo),
    r.certificata_da_nome,
  ]);

  // Stesso `try` della route admin: `generaCsvSezioni` lancia su un istante non
  // formattato, e fuori da qui sarebbe un 500 del framework senza traccia.
  // ⚠️ Una sezione sola, e non più `generaCsv`: la nota sui minuti «non
  // calcolabili» ha bisogno di una riga sotto il titolo, che un CSV a tabella
  // unica non ha.
  let csv: string;
  try {
    csv = generaCsvSezioni([
      {
        titolo: `Presenze — ${evento.titolo}`,
        intestazioni,
        righe: corpo,
        seNonCeNiente: "Nessuno studente della tua scuola risulta iscritto a questo incontro.",
        nota: [notaMinuti(evento.data_fine, elenco), notaFinestra(evento.data_inizio, elenco)],
      },
    ]);
  } catch (e) {
    console.error("Errore generazione CSV presenze (scuola):", descriviErrore(e));
    const rifiuto = rifiutoExport(e);
    return NextResponse.json({ errore: rifiuto.testo }, { status: rifiuto.stato });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="presenze-scuola-${id}.csv"`,
    },
  });
}
