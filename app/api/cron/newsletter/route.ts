import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { inviaEmail } from "@/lib/email/brevo";
import { registraGuasto } from "@/lib/guasti/registra";
import { eOraDiInvio, giornoItaliano } from "@/lib/newsletter/regole";
import { giroInvio } from "@/lib/newsletter/invio";
import { descriviErrore } from "@/lib/erroreSupabase";

// L'invio delle newsletter degli enti (30/10). Protetta da CRON_SECRET come il
// motore dei workshop.
//
// ⚠️ L'ORA È ITALIANA: 7:30, sempre. `vercel.json` la chiama due volte (5:30 e
// 6:30 UTC), perché l'Italia cambia ora due volte l'anno e un orario fisso in
// UTC diventerebbe le 8:30 d'estate senza che nessuno se ne accorga. La route
// lavora solo nel giro che in Italia cade nell'ora delle 7; l'altro risponde
// «fuori orario» e non fa niente. Due giri nella stessa ora non mandano due
// volte: la coda dà al più un'email per studente al giorno.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROCESSO = "cron/newsletter";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const adesso = new Date();
  if (!eOraDiInvio(adesso)) {
    return NextResponse.json({ fatto: false, motivo: "fuori orario: si manda alle 7:30 ora italiana" });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error(`[${PROCESSO}] configurazione:`, descriviErrore(e));
    await registraGuasto({ processo: PROCESSO, specie: "configurazione", dettaglio: e });
    return NextResponse.json({ errore: "Configurazione mancante." }, { status: 500 });
  }

  const oggi = giornoItaliano(adesso);
  const esito = await giroInvio(supabase, inviaEmail, oggi);

  // Un guasto per passo, non uno per destinatario: cento email fallite per il
  // tetto di Brevo sono una cosa sola da leggere, con il numero.
  const perPasso = new Map<string, { n: number; dettaglio: string }>();
  for (const g of esito.guasti) {
    const v = perPasso.get(g.passo);
    perPasso.set(g.passo, { n: (v?.n ?? 0) + 1, dettaglio: v?.dettaglio ?? g.dettaglio });
  }
  for (const [passo, { n, dettaglio }] of perPasso) {
    console.error(`[${PROCESSO}] ${passo}: ${n} volte, la prima: ${dettaglio}`);
    await registraGuasto({
      processo: PROCESSO,
      specie: passo === "email" ? "email_newsletter" : "invio_newsletter",
      motivo: `${passo} ×${n}`,
      dettaglio,
    });
  }

  return NextResponse.json({ fatto: true, oggi, ...esito, guasti: esito.guasti.length });
}
