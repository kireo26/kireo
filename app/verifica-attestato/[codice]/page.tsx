import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getFiloneBySlug } from "@/data/filoniDocenti";

export const metadata: Metadata = {
  title: "Verifica attestato — KIREO",
  description: "Verifica l'autenticità di un attestato di partecipazione rilasciato da KIREO.",
};

// Pagina pubblica: conferma autenticità con dati minimi (mai l'email del
// docente) tramite la funzione SQL verifica_attestato() — un codice non
// valido mostra un esito onesto, mai un errore muto.
export default async function VerificaAttestatoPage({ params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("verifica_attestato", { p_codice: codice });
  const risultato = Array.isArray(data) ? data[0] : data;
  const valido = Boolean(risultato?.valido);

  return (
    <section className="mx-auto max-w-xl px-6 py-20 sm:pt-28">
      <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Verifica attestato</p>
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
        {valido ? "Attestato autentico" : "Codice non valido"}
      </h1>

      {valido && risultato ? (
        <div className="mt-8 rounded-2xl border border-kireo-green/40 bg-kireo-card p-6">
          <p className="text-sm text-kireo-muted">Nome</p>
          <p className="font-heading text-lg font-semibold text-kireo-light">{risultato.nome_completo}</p>

          <p className="mt-4 text-sm text-kireo-muted">Webinar</p>
          <p className="text-kireo-light/90">{risultato.titolo_evento}</p>

          <p className="mt-4 text-sm text-kireo-muted">Filone</p>
          <p className="text-kireo-light/90">{getFiloneBySlug(risultato.filone)?.nome ?? risultato.filone}</p>

          <p className="mt-4 text-sm text-kireo-muted">Organizzato da</p>
          <p className="text-kireo-light/90">{risultato.organizzatore_nome}</p>

          <p className="mt-4 text-sm text-kireo-muted">Attestato rilasciato il</p>
          <p className="text-kireo-light/90">
            {new Date(risultato.rilasciato_il).toLocaleDateString("it-IT", { dateStyle: "long" })}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-kireo-muted">
          Il codice indicato non corrisponde a nessun attestato rilasciato da KIREO. Controlla di aver copiato l&apos;indirizzo
          completo, oppure contattaci da{" "}
          <a href="/contatti" className="text-kireo-orange underline underline-offset-2">
            Contatti
          </a>
          .
        </p>
      )}
    </section>
  );
}
