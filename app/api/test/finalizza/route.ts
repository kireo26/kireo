import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evidenzeDaRighe } from "@/lib/test/payload";
import { T3_FROZEN_ITEM_ID } from "@/lib/test/assembla-t3";
import { segnalaGuasto } from "@/lib/guasti/registra";

export const runtime = "nodejs";

// Il nome con cui questo processo si presenta nella tabella dei guasti.
const PROCESSO = "test/finalizza";

function erroreDiCortesia(testo: string, status: number) {
  return NextResponse.json({ errore: testo }, { status });
}

// Lo passa il chiamante, mai dedotto dalla tabella dei guasti: è il robot del
// banco o uno studente vero? Stessa lettura di /api/escape/finalizza.
async function eDiProva(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("di_prova").eq("id", userId).maybeSingle();
  return data?.di_prova === true;
}

// Finalizza un test attitudinale: legge le risposte AUTOREVOLI dal DB (mai
// quelle inviate dal client), calcola le prove (scoring deterministico dal
// config), le persiste e aggrega il profilo tramite registra_evidenze_test
// (SECURITY DEFINER). Usa la sessione dello studente (nessun service-role): la
// funzione RPC verifica l'ownership via auth.uid(). Stesso schema di
// /api/escape/finalizza.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return erroreDiCortesia("Devi accedere con il tuo profilo studente.", 401);

  let body: { attemptId?: string };
  try {
    body = await request.json();
  } catch {
    return erroreDiCortesia("Richiesta non valida.", 400);
  }
  if (!body.attemptId) return erroreDiCortesia("Tentativo mancante.", 400);

  // attempt del chiamante
  const { data: attempt } = await supabase
    .from("test_attempt")
    .select("id, test_slug, stato")
    .eq("id", body.attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!attempt) return erroreDiCortesia("Tentativo non trovato.", 404);

  // risposte autorevoli dal DB
  const { data: righe } = await supabase.from("test_response").select("item_id, payload").eq("attempt_id", attempt.id);

  // Scoring deterministico → prove (gestisce negativi, scelte forzate e
  // assi/aree sotto zero, che semplicemente non generano prove). La lettura
  // del payload vive in `lib/test/payload.ts`, non qui: è il pezzo che il
  // banco deve poter attraversare con le risposte vere del robot.
  const evidenze = evidenzeDaRighe(attempt.test_slug, attempt.id, righe ?? []);

  // UN TEST CHE NON PRODUCE NESSUNA PROVA NON È UN TEST COMPLETATO.
  //
  // Prima di qui la RPC veniva chiamata con l'array vuoto: nessun errore,
  // nessuna riga in `evidence`, e il tentativo marcato `completata`. Il
  // profilo restava vuoto e il primo ad accorgersene era T3, due test più
  // tardi, dicendo che le aree candidate erano meno di tre — a quel punto
  // senza niente, da nessuna parte, che dicesse perché. È la specie del
  // feedback finale del 18/09: un lavoro che non c'è, dichiarato riuscito.
  //
  // I DUE MOTIVI SI DISTINGUONO, perché si riparano in modi diversi: nessuna
  // riga salvata è una scrittura che non è arrivata (client, RLS, rete);
  // righe presenti e zero prove è lo scoring che non le ha riconosciute —
  // una forma di payload che non sa leggere, o un item id che non esiste più
  // nel config. Il secondo è quello che è successo davvero.
  if (evidenze.length === 0) {
    const salvate = (righe ?? []).filter((r) => r.item_id !== T3_FROZEN_ITEM_ID).length;
    const diProva = await eDiProva(supabase, user.id);
    await segnalaGuasto(
      {
        processo: PROCESSO,
        specie: "prove_test",
        motivo: salvate === 0 ? "nessuna risposta salvata" : "risposte presenti, nessuna prova",
        dettaglio: `test=${attempt.test_slug} attempt=${attempt.id} righe=${salvate}`,
        diProva,
      },
      `Errore test/finalizza — nessuna prova: il tentativo NON viene completato. studente=${user.id} test=${attempt.test_slug} attempt=${attempt.id} righe=${salvate}`,
    );
    return erroreDiCortesia(
      salvate === 0
        ? "Non risulta nessuna risposta salvata per questo test: riprendilo e riprova."
        : "Non è stato possibile calcolare l'esito di questo test. Il tentativo resta aperto: riprova fra poco.",
      salvate === 0 ? 400 : 500,
    );
  }

  const { error: erroreRpc } = await supabase.rpc("registra_evidenze_test", {
    p_attempt_id: attempt.id,
    p_evidenze: evidenze,
  });
  if (erroreRpc) {
    // Le prove c'erano e non sono arrivate: il profilo non si è mosso, e
    // questa è la classe di guasto che si vede mesi dopo, quando qualcuno si
    // chiede perché un'area non è mai salita.
    await segnalaGuasto(
      {
        processo: PROCESSO,
        specie: "prove_test",
        motivo: "registra_evidenze_test",
        dettaglio: erroreRpc,
        diProva: await eDiProva(supabase, user.id),
      },
      `Errore test/finalizza — registra_evidenze_test: test=${attempt.test_slug} attempt=${attempt.id}`,
    );
    return erroreDiCortesia("Non è stato possibile salvare l'esito del test. Riprova.", 500);
  }

  return NextResponse.json({ ok: true });
}
