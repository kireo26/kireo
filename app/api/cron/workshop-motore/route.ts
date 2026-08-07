import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { MODELLO_CLIENTE_WORKSHOP, WORKSHOP_CLIENTE_NOME, WORKSHOP_CLIENTE_PROMPTS } from "@/lib/workshop/config";
import { WORKSHOP_ELABORATO, WORKSHOP_TUTOR_CONTESTO } from "@/lib/workshop/elaborato-config";
import { serializzaValoreSezione, type FeedbackFinale, type RevisioneTappa, type ValoreSezione } from "@/lib/workshop/elaboratoValore";
import { promptRevisore, promptReazioneClienteUser, promptFeedbackFinale, type CtxTappa } from "@/lib/workshop/prompt-revisore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVISIONE_VUOTA: RevisioneTappa = {
  punti_forza: [],
  da_migliorare: [],
  domanda: "",
  commento_breve: "",
  punteggio_fiducia: 0,
};

function estraiJson(testo: string): unknown {
  return JSON.parse(testo.replace(/```json|```/g, "").trim());
}

// Motore del tempo di Workshop 2.0 v2: per ogni tappa 'consegnata' il cui
// cooldown è passato, genera la revisione del tutor + la reazione in
// carattere del cliente (prompt cablati da lib/workshop/prompt-revisore.ts,
// forniti da Mario — non re-inventati qui), aggiorna la fiducia, apre la
// tappa successiva (o chiude l'intero progetto con un feedback finale
// separato se è l'ultima) e notifica lo studente. Protetta da CRON_SECRET
// (header Authorization: Bearer <secret>, la convenzione standard di
// Vercel Cron) — nessuna sessione studente qui, per questo usa la service
// role key (bypassa la RLS) invece del client cookie-based usato da ogni
// altra route del progetto.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!cronSecret || header !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY non configurata: il motore workshop non può generare revisione/reazione.");
    return NextResponse.json({ errore: "Chiave Anthropic non configurata." }, { status: 503 });
  }

  const supabase = createServiceRoleClient();
  const client = new Anthropic({ apiKey });

  // Override di test: minuti invece di giorni per il cooldown di OGNI
  // tappa, per collaudare il gating senza aspettare giorni veri (vedi
  // CLAUDE.md per come usarlo).
  const cooldownMinutiOverride = process.env.WORKSHOP_COOLDOWN_MINUTI ? Number(process.env.WORKSHOP_COOLDOWN_MINUTI) : null;

  const { data: righe, error: erroreSelect } = await supabase
    .from("workshop_fasi_stato")
    .select(
      "id, iscrizione_id, fase_id, consegnata_at, workshop_iscrizioni(student_id, workshop_id, ruolo_id, workshop(slug, titolo), workshop_ruoli(slug, titolo, area_slug))",
    )
    .eq("stato", "consegnata");

  if (erroreSelect) {
    console.error("Errore lettura tappe consegnate:", erroreSelect);
    return NextResponse.json({ errore: "Errore di lettura." }, { status: 500 });
  }

  let processate = 0;
  let saltate = 0;
  let errori = 0;

  for (const riga of righe ?? []) {
    try {
      const iscrizione = Array.isArray(riga.workshop_iscrizioni) ? riga.workshop_iscrizioni[0] : riga.workshop_iscrizioni;
      const workshop = iscrizione ? (Array.isArray(iscrizione.workshop) ? iscrizione.workshop[0] : iscrizione.workshop) : null;
      const ruolo = iscrizione ? (Array.isArray(iscrizione.workshop_ruoli) ? iscrizione.workshop_ruoli[0] : iscrizione.workshop_ruoli) : null;
      if (!iscrizione || !workshop || !ruolo || !riga.consegnata_at) {
        saltate++;
        continue;
      }

      const fasi = WORKSHOP_ELABORATO[workshop.slug]?.[ruolo.slug]?.fasi;
      const fase = fasi?.find((f) => f.id === riga.fase_id);
      if (!fasi || !fase) {
        saltate++;
        continue;
      }

      const cooldownMs =
        cooldownMinutiOverride !== null && !Number.isNaN(cooldownMinutiOverride)
          ? cooldownMinutiOverride * 60_000
          : fase.cooldownGiorni * 86_400_000;
      const dueDa = new Date(riga.consegnata_at).getTime() + cooldownMs;
      if (Date.now() < dueDa) {
        saltate++;
        continue;
      }

      const { data: elaborato } = await supabase
        .from("workshop_elaborati")
        .select("contenuto, fiducia")
        .eq("iscrizione_id", riga.iscrizione_id)
        .maybeSingle();

      const contenuto = (elaborato?.contenuto ?? {}) as Record<string, ValoreSezione>;
      const fiduciaPrima = elaborato?.fiducia ?? 0;

      const contenutoTappa: Record<string, unknown> = {};
      for (const sezione of fase.sezioni) {
        if (contenuto[sezione.id] !== undefined) contenutoTappa[sezione.id] = contenuto[sezione.id];
      }

      const nomeCliente = WORKSHOP_CLIENTE_NOME[workshop.slug] ?? "il cliente";
      const ctx: CtxTappa = {
        workshopTitolo: workshop.titolo,
        ruoloTitolo: ruolo.titolo,
        tappaTitolo: fase.titolo,
        tappaObiettivo: fase.obiettivo,
        clienteNome: nomeCliente,
        clienteVincoli: WORKSHOP_TUTOR_CONTESTO[workshop.slug]?.vincoli ?? "",
        revisioneFocus: fase.revisioneFocus,
        fiduciaMax: fase.fiduciaMax,
      };

      let revisione: RevisioneTappa = REVISIONE_VUOTA;
      try {
        const rispostaRevisione = await client.messages.create({
          model: MODELLO_CLIENTE_WORKSHOP,
          max_tokens: 700,
          system: promptRevisore(ctx),
          messages: [{ role: "user", content: JSON.stringify(contenutoTappa, null, 2) }],
        });
        const testo = rispostaRevisione.content[0]?.type === "text" ? rispostaRevisione.content[0].text : "{}";
        const parsed = estraiJson(testo) as Record<string, unknown>;
        if (
          Array.isArray(parsed.punti_forza) &&
          Array.isArray(parsed.da_migliorare) &&
          typeof parsed.domanda === "string" &&
          typeof parsed.commento_breve === "string" &&
          typeof parsed.punteggio_fiducia === "number"
        ) {
          revisione = {
            punti_forza: parsed.punti_forza as string[],
            da_migliorare: parsed.da_migliorare as string[],
            domanda: parsed.domanda,
            commento_breve: parsed.commento_breve,
            punteggio_fiducia: Math.max(0, Math.min(fase.fiduciaMax, Math.round(parsed.punteggio_fiducia as number))),
          };
        }
      } catch (erroreRevisione) {
        console.error(`Errore generazione revisione (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}):`, erroreRevisione);
      }

      const fiduciaDopo = Math.max(0, Math.min(100, fiduciaPrima + revisione.punteggio_fiducia));

      let reazioneCliente = "";
      const promptCliente = WORKSHOP_CLIENTE_PROMPTS[workshop.slug];
      if (promptCliente) {
        try {
          const sintesi = fase.sezioni
            .map((s) => `${s.titolo}: ${serializzaValoreSezione(s, contenuto[s.id]) || "(non compilata)"}`)
            .join("\n\n");
          const rispostaReazione = await client.messages.create({
            model: MODELLO_CLIENTE_WORKSHOP,
            max_tokens: 300,
            system: promptCliente,
            messages: [{ role: "user", content: promptReazioneClienteUser(sintesi, fase.reazioneCliente) }],
          });
          reazioneCliente = rispostaReazione.content[0]?.type === "text" ? rispostaReazione.content[0].text : "";
        } catch (erroreReazione) {
          console.error(`Errore generazione reazione cliente (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}):`, erroreReazione);
        }
      }

      // Feedback finale, SOLO per l'ultima tappa: chiamata AI separata
      // (forma diversa dalla revisione per-tappa, vedi
      // lib/workshop/prompt-revisore.ts), basata sul contenuto COMPLETO
      // del progetto (tutte le tappe), non solo su questa.
      let feedbackFinale: FeedbackFinale | null = null;
      if (fase.ultima) {
        try {
          const rispostaFinale = await client.messages.create({
            model: MODELLO_CLIENTE_WORKSHOP,
            max_tokens: 700,
            system: promptFeedbackFinale(ctx, fiduciaDopo),
            messages: [{ role: "user", content: JSON.stringify(contenuto, null, 2) }],
          });
          const testo = rispostaFinale.content[0]?.type === "text" ? rispostaFinale.content[0].text : "{}";
          const parsed = estraiJson(testo) as Record<string, unknown>;
          if (
            Array.isArray(parsed.punti_forza) &&
            Array.isArray(parsed.da_migliorare) &&
            typeof parsed.messaggio_chiusura === "string" &&
            typeof parsed.chiusura_cliente === "string" &&
            typeof parsed.punteggio_area === "number"
          ) {
            feedbackFinale = {
              punti_forza: parsed.punti_forza as string[],
              da_migliorare: parsed.da_migliorare as string[],
              messaggio_chiusura: parsed.messaggio_chiusura,
              chiusura_cliente: parsed.chiusura_cliente,
              punteggio_area: Math.max(0, Math.min(100, Math.round(parsed.punteggio_area as number))),
            };
          }
        } catch (erroreFinale) {
          console.error(`Errore generazione feedback finale (iscrizione ${riga.iscrizione_id}):`, erroreFinale);
        }
      }

      const indiceFase = fasi.findIndex((f) => f.id === fase.id);
      const prossimaFase = fasi[indiceFase + 1] ?? null;

      // Nota: punteggio_area (0-100, il "voto" complessivo del progetto)
      // resta salvato dentro feedback_ai per lo studente, ma NON diventa
      // il peso della riga activity_log — quel peso è fisso per tipo in
      // tutta la piattaforma (workshop_pcto=25, come ogni altro tipo di
      // attività), e usare un numero variabile 0-100 lì romperebbe
      // l'assunzione additiva di score_aree/il radar attitudinale.
      const { error: erroreAvanza } = await supabase.rpc("avanza_fase_workshop", {
        p_iscrizione_id: riga.iscrizione_id,
        p_fase_id: riga.fase_id,
        p_prossima_fase_id: prossimaFase?.id ?? null,
        p_revisione: revisione,
        p_reazione_cliente: reazioneCliente || null,
        p_punteggio_fiducia: revisione.punteggio_fiducia,
        p_ultima: Boolean(fase.ultima),
        p_area_slug: ruolo.area_slug,
        p_feedback_finale: feedbackFinale,
      });

      if (erroreAvanza) {
        console.error(`Errore avanzamento tappa (iscrizione ${riga.iscrizione_id}, tappa ${riga.fase_id}):`, erroreAvanza);
        errori++;
        continue;
      }

      const notifiche = [{ student_id: iscrizione.student_id, tipo: "workshop_tappa_revisionata", riferimento_id: riga.iscrizione_id }];
      if (prossimaFase) {
        notifiche.push({ student_id: iscrizione.student_id, tipo: "workshop_tappa_aperta", riferimento_id: riga.iscrizione_id });
      }
      const { error: erroreNotifica } = await supabase.from("notifiche_studenti").insert(notifiche);
      if (erroreNotifica) {
        console.error(`Errore inserimento notifiche (iscrizione ${riga.iscrizione_id}):`, erroreNotifica);
      }

      processate++;
    } catch (erroreRiga) {
      console.error("Errore elaborazione riga workshop_fasi_stato:", erroreRiga);
      errori++;
    }
  }

  return NextResponse.json({ processate, saltate, errori });
}
