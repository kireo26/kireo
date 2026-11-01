import Link from "next/link";
import { getScuolaContext } from "@/lib/scuola/context";
import { createClient } from "@/lib/supabase/server";
import { TESTO_STUDENTI_NON_LETTI, emailPerVerifica, emailVerificato, leggiStudentiDellaScuola, soloDichiarati, soloVerificati } from "@/lib/scuola/studenti";
import { etichettaPrincipaleStudente, nomeCompletoStudente } from "@/lib/scuola/formatStudente";
import GestioneStudentiDichiarati from "@/components/scuola/GestioneStudentiDichiarati";

// Pagina sempre navigabile da qualunque staff attivo (referente o tutor,
// con o senza delega): la lettura resta sempre disponibile, solo le azioni
// di verifica/rifiuto sono gated da puoVerificareStudenti dentro
// GestioneStudentiDichiarati — niente pagina che respinge in silenzio.
export default async function ScuolaStudentiPage() {
  const contesto = await getScuolaContext();
  const supabase = await createClient();

  const [studenti, { data: classiStudenti, error: erroreClassiStudenti }] = await Promise.all([
    leggiStudentiDellaScuola(supabase),
    supabase.from("classi_studenti").select("student_id, classi(nome_visualizzato)"),
  ]);

  if (erroreClassiStudenti) console.error("[/scuola/studenti] errore query classiStudenti:", erroreClassiStudenti);

  const classePerStudente = new Map<string, string>();
  for (const riga of classiStudenti ?? []) {
    const classe = Array.isArray(riga.classi) ? riga.classi[0] : riga.classi;
    if (classe?.nome_visualizzato) classePerStudente.set(riga.student_id, classe.nome_visualizzato);
  }

  // L'email di un dichiarato compare solo qui, sulle righe in attesa (lib/scuola/studenti.ts).
  const studentiDichiarati = soloDichiarati(studenti ?? []).map((s) => ({
    userId: s.userId,
    nome: s.nome ?? "",
    cognome: s.cognome ?? "",
    classe: s.classe,
    email: emailPerVerifica(s),
    dichiaratoIl: s.dichiaratoIl ?? "",
  }));
  const verificati = soloVerificati(studenti ?? []).sort((a, b) => (a.classe ?? "").localeCompare(b.classe ?? ""));

  return (
    <div className="space-y-10">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Studenti</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Verifica studenti</h1>
        <p className="mt-2 text-kireo-muted">
          Conferma che uno studente autodichiarato appartiene davvero alla tua scuola. La verifica è definitiva: uno studente
          verificato non può cambiare scuola da solo, e non può essere sganciato da qui.
        </p>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">In attesa di verifica</h2>
        <div className="mt-4">
          {studenti === null && <p className="mb-3 text-sm text-red-300">{TESTO_STUDENTI_NON_LETTI}</p>}
          <GestioneStudentiDichiarati studenti={studentiDichiarati} puoAgire={contesto.puoVerificareStudenti} />
        </div>
      </div>

      <div>
        <h2 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">Studenti verificati</h2>
        {studenti === null ? (
          <p className="mt-3 text-sm text-red-300">{TESTO_STUDENTI_NON_LETTI}</p>
        ) : verificati.length === 0 ? (
          <p className="mt-3 text-sm text-kireo-muted">Nessuno studente verificato ancora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {verificati.map((s) => {
              const nome = s.nome ?? "";
              const cognome = s.cognome ?? "";
              const email = emailVerificato(s);
              const nomeCompleto = nomeCompletoStudente(nome, cognome);
              return (
                <li key={s.userId} className="rounded-xl border border-white/5 bg-kireo-card p-4">
                  <Link href={`/scuola/studenti/${s.userId}`} className="flex flex-wrap items-center justify-between gap-3 hover:underline">
                    <span>
                      <span className="font-heading text-sm font-semibold text-kireo-light">
                        {etichettaPrincipaleStudente(nome, cognome, email)}
                      </span>
                      {nomeCompleto && email && <span className="ml-2 text-xs text-kireo-muted">{email}</span>}
                    </span>
                    <span className="text-xs text-kireo-muted">
                      {classePerStudente.get(s.userId) ?? "Nessuna classe assegnata"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
