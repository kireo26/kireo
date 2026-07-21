import Link from "next/link";
import { notFound } from "next/navigation";
import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { getDettaglioStudente } from "@/lib/scuola/studenteDettaglio";
import { etichettaPrincipaleStudente, nomeCompletoStudente } from "@/lib/scuola/formatStudente";

const ETICHETTA_CERTIFICATORE: Record<string, string> = {
  sistema: "Certificato automaticamente",
  kireo: "Certificato da KIREO",
  scuola: "Certificato dalla tua scuola",
};

// Scheda di uno studente verificato della propria scuola: solo dati
// "amministrativi" (anagrafica, classe, partecipazioni certificate) — mai
// score, radar, activity_log o altro dato di profilazione, che restano
// riservati allo studente nella sua area personale. Accessibile a
// referente e tutor (nessun richiedeReferente qui).
export default async function ScuolaStudenteDettaglioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const studente = await getDettaglioStudente(supabase, id, contesto.scuolaId, contesto.scuolaProfiloId);
  if (!studente) notFound();

  const nomeCompleto = nomeCompletoStudente(studente.nome, studente.cognome);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/scuola/studenti" className="text-sm text-kireo-muted hover:underline">
          ← Torna a Verifica studenti
        </Link>
        <p className="mb-4 mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Scheda studente</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
          {etichettaPrincipaleStudente(studente.nome, studente.cognome, studente.email)}
        </h1>
        {nomeCompleto && studente.email && <p className="mt-1 text-sm text-kireo-muted">{studente.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Classe assegnata</p>
          <p className="mt-1 font-heading text-lg font-semibold text-kireo-light">{studente.classeAssegnata ?? "Nessuna classe assegnata"}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Stato verifica</p>
          <p className="mt-1 font-heading text-lg font-semibold text-kireo-green-light">Verificato</p>
          {studente.verificatoIl && (
            <p className="mt-1 text-xs text-kireo-muted">
              il {new Date(studente.verificatoIl).toLocaleDateString("it-IT", { dateStyle: "long" })}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-kireo-muted">Ore PCTO certificate</p>
          <p className="mt-1 font-heading text-lg font-semibold text-kireo-light">{studente.totaleOrePcto}</p>
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Partecipazioni certificate</h2>
        {studente.partecipazioni.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessuna partecipazione certificata ancora.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {studente.partecipazioni.map((p) => (
              <li key={p.eventoId} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                <p className="font-heading text-sm font-semibold text-kireo-light">{p.titolo}</p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {p.dataInizio && new Date(p.dataInizio).toLocaleDateString("it-IT", { dateStyle: "long" })}
                  {p.orePcto > 0 && ` · ${p.orePcto}h PCTO`}
                </p>
                <p className="mt-1 text-xs text-kireo-muted">
                  {(p.certificataDaTipo && ETICHETTA_CERTIFICATORE[p.certificataDaTipo]) ?? "Certificato"}
                  {p.certificataDaTipo === "scuola" && p.certificataDaNome && ` — ${p.certificataDaNome}`}
                  {p.certificataIl && ` · ${new Date(p.certificataIl).toLocaleDateString("it-IT", { dateStyle: "long" })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
