"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";
import type { ContattoEnti } from "@/lib/app/contattoEnti";
import { DIDASCALIA_CONDIVISO_CON_ATTIVITA, DIDASCALIA_CONDIVISO_SENZA_ATTIVITA } from "@/lib/app/gestiEnte";

// Aperto dai 14 anni, cioè a chiunque possa iscriversi (dal 20261109100000:
// il blocco dei 18 anni non lo chiedeva nessuna legge, e chiudeva il gesto a
// quasi tutti su una piattaforma di quarte e quinte). Condivide nome, cognome, scuola e
// aree di interesse con l'ente — MAI email/telefono, il contatto passa
// solo dai messaggi in piattaforma. Revocabile qui e da /app/profilo.
export default function ManifestazioneInteresseButton({
  istituzioneId,
  userId,
  contatto,
  manifestazioneAttivaId,
  didascalia,
  copreAttivita,
}: {
  istituzioneId: string;
  userId: string | null;
  // Obbligatorio apposta: un default farebbe ricomparire il bottone a chi il
  // database lo rifiuta (lib/app/contattoEnti.ts).
  contatto: ContattoEnti;
  manifestazioneAttivaId: string | null;
  didascalia?: string;
  // Che cosa copre la condivisione ATTIVA (20261111100000): obbligatorio,
  // perché un default direbbe allo studente una cosa diversa da quella che
  // l'ente vede.
  copreAttivita: boolean;
}) {
  const pathname = usePathname();
  const [id, setId] = useState(manifestazioneAttivaId);
  const [copre, setCopre] = useState(copreAttivita);
  const [mostraInfo, setMostraInfo] = useState(false);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!userId) {
    return (
      <div>
        <Link
          href={`/accedi?redirectedFrom=${encodeURIComponent(pathname)}`}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/50"
        >
          Condividi il tuo profilo con questo ente
        </Link>
        {didascalia && <p className="mt-2 max-w-[15rem] text-xs leading-snug text-kireo-muted">{didascalia}</p>}
      </div>
    );
  }

  // Chi non può condividere non vede il bottone; la ragione la dice la pagina,
  // sotto la fila. Ma una condivisione già attiva mostra sempre la revoca:
  // un'uscita non si nasconde dietro una regola sull'entrata.
  if (contatto !== "si" && !id) return null;

  async function condividi() {
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("manifestazioni_interesse")
        .insert({ student_id: userId, istituzione_id: istituzioneId })
        .select("id")
        .single();
      if (error || !data) {
        setErrore("Non è stato possibile completare l'operazione. Riprova.");
        return;
      }
      setId(data.id);
      // Una condivisione nuova nasce con il pannello di oggi, che nomina
      // l'attività (il valore di partenza della colonna).
      setCopre(true);
      setMostraInfo(false);
    } finally {
      setCaricamento(false);
    }
  }

  async function revoca() {
    if (!id) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("manifestazioni_interesse").update({ revocata_il: new Date().toISOString() }).eq("id", id);
      if (error) {
        setErrore("Non è stato possibile revocare. Riprova.");
        return;
      }
      setId(null);
    } finally {
      setCaricamento(false);
    }
  }

  if (id) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={revoca} disabled={caricamento}>
          {caricamento ? "Un momento…" : "Profilo condiviso ✓ — Revoca"}
        </Button>
        {/* La riga resta anche a profilo condiviso, e qui dice il presente:
            è il momento in cui descrive quello che sta succedendo. */}
        {didascalia && (
          <p className="max-w-[15rem] text-xs leading-snug text-kireo-muted">
            {copre ? DIDASCALIA_CONDIVISO_CON_ATTIVITA : DIDASCALIA_CONDIVISO_SENZA_ATTIVITA}
          </p>
        )}
        {errore && <p className="text-xs text-red-400">{errore}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!mostraInfo ? (
        // A pannello aperto la didascalia sparisce: lì i campi si leggono per
        // intero, e due testi sulla stessa cosa a un centimetro si
        // contraddirebbero appena uno dei due cambia.
        <div>
          <Button type="button" variant="outline" onClick={() => setMostraInfo(true)}>
            Condividi il tuo profilo con questo ente
          </Button>
          {didascalia && <p className="mt-2 max-w-[15rem] text-xs leading-snug text-kireo-muted">{didascalia}</p>}
        </div>
      ) : (
        <div className="max-w-sm space-y-3 rounded-xl border border-white/10 bg-kireo-dark/60 p-4 text-left">
          <p className="text-xs text-kireo-muted">
            L&apos;ente vedrà nome, cognome, la tua scuola e le aree di orientamento che hai scelto, e cosa hai fatto
            verso di lui su KIREO: a quali suoi eventi hai partecipato e per quanto, e se hai scaricato la sua guida.
            Non vedrà i tuoi test, le missioni né i workshop. Non condivide mai email o telefono:
            potrà scriverti solo tramite i messaggi di KIREO. Puoi revocare quando vuoi.
          </p>
          {errore && <p className="text-xs text-red-400">{errore}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="primary" onClick={condividi} disabled={caricamento}>
              {caricamento ? "Un momento…" : "Conferma"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setMostraInfo(false)} disabled={caricamento}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
