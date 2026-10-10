import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generaCsvSezioni, type SezioneCsv } from "@/lib/csv";

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

  // `domanda_consegna` serve a distinguere «nessuno ha risposto» da «non è
  // stata posta nessuna domanda»: senza, la sezione vuota direbbe la prima su
  // un evento in cui la seconda è la verità — cioè un'affermazione sugli
  // studenti al posto di una su di noi.
  const { data: evento } = await supabase.from("eventi").select("titolo, pubblico, domanda_consegna").eq("id", id).maybeSingle();
  if (!evento) {
    return NextResponse.json({ errore: "Evento non trovato." }, { status: 404 });
  }

  // ⚠️ TRE LETTURE, E UN SOLO FALLIMENTO BLOCCANTE: quello delle presenze, che
  // è la ragione per cui questo export esiste (le ore che finiscono su un
  // documento di scuola). Se a non arrivare sono le domande o le consegne, il
  // file esce comunque e la sezione DICE che non si è potuta leggere — perché
  // «non ho guardato» e «non c'era niente» sono due cose diverse, e rifiutare
  // tutto il file per la seconda sezione toglierebbe anche la prima.
  const [{ data: righe, error }, { data: domande, error: erroreDomande }, { data: consegne, error: erroreConsegne }] =
    await Promise.all([
      supabase.rpc("esporta_presenze_admin", { p_evento_id: id }),
      supabase.rpc("esporta_domande_evento", { p_evento_id: id }),
      supabase.rpc("esporta_consegne_evento", { p_evento_id: id }),
    ]);
  if (error) {
    console.error("Errore esporta_presenze_admin:", error.message ?? error);
    return NextResponse.json({ errore: "Non è stato possibile generare l'export." }, { status: 500 });
  }
  if (erroreDomande) console.error("Errore esporta_domande_evento:", erroreDomande.message ?? erroreDomande);
  if (erroreConsegne) console.error("Errore esporta_consegne_evento:", erroreConsegne.message ?? erroreConsegne);

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

  // ⚠️ NESSUN NOME NELLE DUE SEZIONI NUOVE, ed è un vincolo di Mario: sulle
  // presenze i nomi hanno una ragione (la scuola certifica delle ore a delle
  // persone), su domande e consegne no. La proprietà è STRUTTURALE e non «la
  // route non stampa quella colonna»: le due RPC non nominano `profiles` in
  // nessun ramo, quindi un nome qui non ci sarebbe nemmeno volendo.
  const sezioni: SezioneCsv[] = [
    {
      titolo: `Presenze — ${evento.titolo}`,
      intestazioni,
      righe: corpo,
      seNonCeNiente: "Nessuno si è collegato a questa diretta.",
    },
    {
      titolo: "Domande fatte durante la diretta (anonime)",
      intestazioni: ["Fatta il", "Testo", "Stato", "Toccata da", "Toccata il"],
      righe: erroreDomande
        ? []
        : (domande ?? []).map(
            (q: { creata_il: string; testo: string; stato: string; toccata_da: string | null; toccata_il: string | null }) => [
              q.creata_il,
              q.testo,
              q.stato,
              q.toccata_da,
              q.toccata_il,
            ],
          ),
      seNonCeNiente: erroreDomande
        ? "Non è stato possibile leggere le domande: questa sezione manca per un problema nostro, non perché non ce ne fossero."
        : "Nessuno ha fatto domande durante questa diretta.",
    },
    {
      titolo: "Risposte alla domanda finale (anonime)",
      intestazioni: ["Consegnata il", "Testo", "Giudizio arrivato", "Giudicata il", "Caratteri"],
      righe: erroreConsegne
        ? []
        : (consegne ?? []).map(
            (c: { consegnata_il: string; testo: string; valutata: boolean; valutata_il: string | null; caratteri: number }) => [
              c.consegnata_il,
              c.testo,
              c.valutata ? "Sì" : "No",
              c.valutata_il,
              c.caratteri,
            ],
          ),
      seNonCeNiente: erroreConsegne
        ? "Non è stato possibile leggere le risposte: questa sezione manca per un problema nostro, non perché non ce ne fossero."
        : evento.domanda_consegna
          ? "Nessuno ha risposto alla domanda finale."
          : "Per questo incontro non è stata posta nessuna domanda finale, quindi non c'era niente a cui rispondere.",
    },
  ];

  const csv = generaCsvSezioni(sezioni);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="presenze-${id}.csv"`,
    },
  });
}
