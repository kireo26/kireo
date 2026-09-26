import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAreaBySlug } from "@/data/aree";
import { guidaPronta, statoSblocco, type LivelloGuida } from "@/lib/guide/config";
import { caricaContestoGuide } from "@/lib/guide/statoStudente";
import { segnalaGuasto } from "@/lib/guasti/registra";

// Il cancello delle guide 2 e 3: l'UNICA strada per quei PDF.
//
// PERCHÉ UNA ROTTA E NON UNA GUARDIA DAVANTI AI FILE. Fino al 2026-09-26 tutte
// e 54 le guide stavano in `public/` e si scaricavano da chiunque conoscesse
// l'indirizzo, anonimo compreso: `statoSblocco` girava solo in pagina, e un
// controllo in pagina non è un cancello. La cura ovvia era una guardia nella
// middleware — che, verificato, vede davvero una richiesta per un file di
// `public/`. Ma su Vercel quei file li serve la rete di distribuzione, e se una
// seconda richiesta allo stesso URL venisse servita dalla cache senza passare
// dalla middleware il cancello funzionerebbe per la prima persona e per nessuna
// altra: **verde in ogni nostra prova e assente là fuori**, che è la specie di
// difetto che non si vede. Quella misura si fa solo su un deploy vero, e finché
// non è fatta non ci si appoggia. Qui invece i livelli 2 e 3 non hanno nessuna
// copia a un indirizzo pubblico: non c'è niente da mettere in cache, e il
// cancello non dipende da una cosa che non sappiamo.
//
// Il livello 1 NON passa da qui: resta statico in `public/guide/<area>/1.pdf`,
// aperto anche da anonimo, perché è il magnete del funnel e perché quell'URL sta
// dentro email già mandate — un indirizzo in un'email non si sposta mai più.
//
// L'attività (`activity_log`, con il livello) la registra il CLIENT prima di
// aprire, come ogni altro punto del sito: qui non si scrive niente.

export const runtime = "nodejs";

const LIVELLI_RISERVATI: LivelloGuida[] = [2, 3];

function allePagineDelleGuide(area: string, extra: Record<string, string> = {}) {
  const qs = new URLSearchParams(extra).toString();
  return `/app/guide/${area}${qs ? `?${qs}` : ""}`;
}

export async function GET(richiesta: Request, { params }: { params: Promise<{ areaSlug: string; livello: string }> }) {
  const { areaSlug, livello: livelloRaw } = await params;

  const livello = Number(livelloRaw) as LivelloGuida;
  if (!LIVELLI_RISERVATI.includes(livello) || !getAreaBySlug(areaSlug)) {
    return new NextResponse("Guida non trovata", { status: 404 });
  }
  // Una guida non ancora scritta è un 404 onesto, non un rifiuto: non c'è
  // niente da sbloccare.
  if (!guidaPronta(areaSlug, livello)) {
    return new NextResponse("Guida non trovata", { status: 404 });
  }

  // FALLISCE CHIUSO, e il try comprende anche la creazione del client: senza
  // quella riga un problema di configurazione — o Supabase irraggiungibile —
  // produceva un 500 grezzo, senza nessuna riga in `guasti` e senza una frase
  // per chi sta dall'altra parte. Se non riusciamo a leggere i segnali non
  // sappiamo se ha diritto, e un cancello che nel dubbio apre non è un cancello.
  // Ma lo DICE: `guasto=1` porta la pagina a scrivere che è un problema nostro,
  // non un giudizio su quello che ha fatto.
  let utenteId: string | null = null;
  let contesto: Awaited<ReturnType<typeof caricaContestoGuide>> | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    utenteId = user?.id ?? null;
    if (utenteId) contesto = await caricaContestoGuide(supabase, utenteId);
  } catch (errore) {
    await segnalaGuasto(
      { processo: "guide/riservata", specie: "guida_riservata", motivo: "segnali_non_letti", dettaglio: errore },
      `[guide] Segnali non letti su ${areaSlug}/${livello}`,
    );
    return NextResponse.redirect(new URL(allePagineDelleGuide(areaSlug, { bloccata: String(livello), guasto: "1" }), richiesta.url));
  }

  // Senza sessione non si può nemmeno sapere se avrebbe diritto: si passa da
  // /accedi e si torna alla pagina delle guide di quest'area, non a una pagina
  // d'errore.
  if (!utenteId || !contesto) {
    const dove = `/accedi?redirectedFrom=${encodeURIComponent(allePagineDelleGuide(areaSlug))}`;
    return NextResponse.redirect(new URL(dove, richiesta.url));
  }

  const stato = statoSblocco(livello, contesto.segnale(areaSlug));
  if (!stato.sbloccata) {
    // Il MOTIVO non viaggia nell'URL: la pagina lo ricalcola da sé. Così non
    // esistono due versioni della stessa frase, e nessuno può fabbricarne una.
    return NextResponse.redirect(new URL(allePagineDelleGuide(areaSlug, { bloccata: String(livello) }), richiesta.url));
  }

  // I PDF riservati vivono FUORI da public/ (vedi `percorsoGuida`), quindi
  // vanno letti dal filesystem della funzione: `outputFileTracingIncludes` in
  // next.config.ts li mette nel bundle. Se un giorno quella riga si perde,
  // questo catch è l'allarme — un 500 muto su una guida sarebbe invisibile.
  const file = path.join(process.cwd(), "content", "guide", areaSlug, `${livello}.pdf`);
  try {
    const bytes = await fs.readFile(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="kireo-${areaSlug}-guida-${livello}.pdf"`,
        // Mai in cache condivisa: la risposta dipende da CHI la chiede.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (errore) {
    await segnalaGuasto(
      { processo: "guide/riservata", specie: "guida_riservata", motivo: "pdf_non_letto", dettaglio: errore },
      `[guide] PDF non leggibile: ${file}`,
    );
    return new NextResponse("Non siamo riusciti a consegnare questa guida. È un problema nostro: riprova fra poco.", { status: 500 });
  }
}
