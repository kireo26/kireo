import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generaCsv } from "@/lib/csv";
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

  const { data: righe, error } = await supabase.rpc("esporta_presenze_scuola", { p_evento_id: id });
  if (error) {
    const rifiuto = rifiutoExport(error);
    if (rifiuto.nostro) console.error("Errore esporta_presenze_scuola:", descriviErrore(error));
    return NextResponse.json({ errore: rifiuto.testo }, { status: rifiuto.stato });
  }

  const intestazioni = ["Nome", "Cognome", "Email", "Classe", "Primo ingresso", "Ultima presenza", "Minuti presenza", "Copertura %", "Stato", "Certificata da", "Certificata da (nome)"];

  const corpo = (righe ?? []).map(
    (r: {
      nome: string;
      cognome: string;
      email: string | null;
      classe_nome: string | null;
      primo_ping: string | null;
      ultimo_ping: string | null;
      minuti_presenza: number | null;
      copertura_percento: number | null;
      stato_finale: string;
      certificata_da_tipo: string | null;
      certificata_da_nome: string | null;
    }) => [
      r.nome,
      r.cognome,
      r.email,
      r.classe_nome,
      r.primo_ping,
      r.ultimo_ping,
      r.minuti_presenza,
      r.copertura_percento,
      r.stato_finale,
      r.certificata_da_tipo,
      r.certificata_da_nome,
    ],
  );

  const csv = generaCsv(intestazioni, corpo);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="presenze-scuola-${id}.csv"`,
    },
  });
}
