import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generaCsv } from "@/lib/csv";

// Solo admin, generazione server-side, nessun endpoint pubblico: la vera
// autorizzazione è comunque nella RPC esporta_presenze_admin (SECURITY
// DEFINER, admin-only) — il controllo qui sotto evita solo di far girare
// la query per un utente che verrebbe comunque respinto.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ errore: "Non autenticato." }, { status: 401 });
  }

  const { data: profilo } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();
  if (profilo?.ruolo !== "admin") {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 });
  }

  const { data: evento } = await supabase.from("eventi").select("titolo, pubblico").eq("id", id).maybeSingle();
  if (!evento) {
    return NextResponse.json({ errore: "Evento non trovato." }, { status: 404 });
  }

  const { data: righe, error } = await supabase.rpc("esporta_presenze_admin", { p_evento_id: id });
  if (error) {
    return NextResponse.json({ errore: "Non è stato possibile generare l'export." }, { status: 500 });
  }

  const perDocenti = evento.pubblico === "docenti";
  const intestazioni = perDocenti
    ? ["Nome", "Cognome", "Email", "Minuti presenza", "Copertura %", "Stato", "Attestato emesso", "Codice attestato"]
    : [
        "Nome",
        "Cognome",
        "Email",
        "Scuola",
        "Codice meccanografico",
        "Classe",
        "Primo ingresso",
        "Ultima presenza",
        "Minuti presenza",
        "Copertura %",
        "Stato",
        "Certificata da",
        "Certificata da (nome)",
      ];

  const corpo = (righe ?? []).map(
    (r: {
      nome: string;
      cognome: string;
      email: string | null;
      scuola_denominazione: string | null;
      scuola_codice: string | null;
      classe_nome: string | null;
      primo_ping: string | null;
      ultimo_ping: string | null;
      minuti_presenza: number | null;
      copertura_percento: number | null;
      stato_finale: string;
      certificata_da_tipo: string | null;
      certificata_da_nome: string | null;
      attestato_emesso: boolean;
      attestato_codice: string | null;
    }) =>
      perDocenti
        ? [r.nome, r.cognome, r.email, r.minuti_presenza, r.copertura_percento, r.stato_finale, r.attestato_emesso ? "Sì" : "No", r.attestato_codice]
        : [
            r.nome,
            r.cognome,
            r.email,
            r.scuola_denominazione,
            r.scuola_codice,
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
      "Content-Disposition": `attachment; filename="presenze-${id}.csv"`,
    },
  });
}
