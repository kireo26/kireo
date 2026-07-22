import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generaAttestatoPdf } from "@/lib/pdf/attestato";
import { getFiloneBySlug } from "@/data/filoniDocenti";

function formattaDurata(dataInizio: string, dataFine: string | null): string | null {
  if (!dataFine) return null;
  const minuti = Math.round((new Date(dataFine).getTime() - new Date(dataInizio).getTime()) / 60000);
  if (minuti <= 0) return null;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (ore === 0) return `${resto}min`;
  return resto === 0 ? `${ore}h` : `${ore}h${resto}`;
}

// Download autenticato: RLS su attestati (select_own/select_organizzatore/
// admin_tutto) decide chi può leggere la riga, questa route si limita a
// generare il PDF da quello che la query restituisce — un 404 onesto se
// RLS nega l'accesso o l'id non esiste, mai un errore muto.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  const { data: attestato } = await supabase
    .from("attestati")
    .select(
      "id, rilasciato_il, codice_verifica, profiles!user_id(nome, cognome), eventi(titolo, data_inizio, data_fine, filone, organizzatore_id, istituzioni(nome))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!attestato) {
    return NextResponse.json({ errore: "Attestato non trovato." }, { status: 404 });
  }

  const profilo = Array.isArray(attestato.profiles) ? attestato.profiles[0] : attestato.profiles;
  const evento = Array.isArray(attestato.eventi) ? attestato.eventi[0] : attestato.eventi;
  const organizzatore = evento ? (Array.isArray(evento.istituzioni) ? evento.istituzioni[0] : evento.istituzioni) : null;

  if (!profilo || !evento) {
    return NextResponse.json({ errore: "Attestato non trovato." }, { status: 404 });
  }

  const filoneLabel = getFiloneBySlug(evento.filone)?.nome ?? evento.filone ?? "";

  const pdf = generaAttestatoPdf({
    nomeCompleto: `${profilo.nome} ${profilo.cognome}`,
    titoloWebinar: evento.titolo,
    filoneLabel,
    dataEventoLabel: new Date(evento.data_inizio).toLocaleDateString("it-IT", { dateStyle: "long" }),
    durataLabel: formattaDurata(evento.data_inizio, evento.data_fine),
    organizzatoreNome: organizzatore?.nome ?? "KIREO",
    codiceVerifica: attestato.codice_verifica,
    rilasciatoIlLabel: new Date(attestato.rilasciato_il).toLocaleDateString("it-IT", { dateStyle: "long" }),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attestato-kireo-${attestato.id}.pdf"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
