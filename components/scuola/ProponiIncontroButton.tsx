"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

// Solo referente/tutor con permesso puo_gestire_classi (gate anche
// server-side in crea_proposta_incontro). Nessun problema di anonimato
// verso l'ente: le scuole sono soggetti istituzionali, il nome della
// scuola è visibile all'ente per costruzione (vedi RLS
// proposte_incontro_select_ente).
export default function ProponiIncontroButton({ istituzioneId, puoProporre }: { istituzioneId: string; puoProporre: boolean }) {
  const [mostraForm, setMostraForm] = useState(false);
  const [descrizione, setDescrizione] = useState("");
  const [nStudenti, setNStudenti] = useState("");
  const [classi, setClassi] = useState("");
  const [datePreferite, setDatePreferite] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inviata, setInviata] = useState(false);

  if (!puoProporre) return null;

  if (inviata) {
    return <p className="text-xs text-kireo-green-light">Proposta inviata ✓</p>;
  }

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!descrizione.trim()) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("crea_proposta_incontro", {
        p_istituzione_id: istituzioneId,
        p_aree: [],
        p_descrizione: descrizione.trim(),
        p_n_studenti_stimato: nStudenti ? Number(nStudenti) : null,
        p_classi_coinvolte: classi.trim() || null,
        p_date_preferite: datePreferite.trim() || null,
      });
      if (error) {
        if (error.message?.includes("troppe_proposte_attive")) setErrore("Hai già 5 proposte attive: attendi una risposta prima di proporne altre.");
        else if (error.message?.includes("proposte_incontro_attiva_coppia_idx")) setErrore("Hai già una proposta attiva verso questo ente.");
        else setErrore("Non è stato possibile inviare la proposta. Riprova.");
        return;
      }
      setInviata(true);
    } finally {
      setCaricamento(false);
    }
  }

  if (!mostraForm) {
    return (
      <Button type="button" variant="outline" onClick={() => setMostraForm(true)}>
        Proponi un incontro di orientamento
      </Button>
    );
  }

  return (
    <form onSubmit={invia} className="space-y-2 rounded-lg border border-white/10 bg-kireo-dark p-3">
      <textarea
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Descrivi cosa vorreste (argomenti, obiettivo dell'incontro)..."
        className="w-full rounded-lg border border-white/10 bg-kireo-card px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="1"
          value={nStudenti}
          onChange={(e) => setNStudenti(e.target.value)}
          placeholder="N. studenti stimato"
          className="rounded-lg border border-white/10 bg-kireo-card px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
        />
        <input
          value={classi}
          onChange={(e) => setClassi(e.target.value)}
          placeholder="Classi coinvolte"
          className="rounded-lg border border-white/10 bg-kireo-card px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
        />
      </div>
      <input
        value={datePreferite}
        onChange={(e) => setDatePreferite(e.target.value)}
        placeholder="Date preferite (es. novembre 2026)"
        className="w-full rounded-lg border border-white/10 bg-kireo-card px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      {errore && <p className="text-xs text-red-400">{errore}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={caricamento || !descrizione.trim()}>
          {caricamento ? "Invio…" : "Invia proposta"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setMostraForm(false)} disabled={caricamento}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
