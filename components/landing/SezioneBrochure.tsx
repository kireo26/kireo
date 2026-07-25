import SectionHeading from "@/components/SectionHeading";

// disponibile è calcolato server-side (fs.existsSync su public/materiali/,
// vedi lib/materiali.ts) dalla pagina chiamante: nessun flag manuale da
// tenere allineato, caricare il PDF al percorso giusto attiva la sezione
// da sola. Finché il file non esiste, stato onesto "in arrivo" — la build
// non genera nessun PDF segnaposto per questa sezione.
export default function SezioneBrochure({ disponibile, percorsoFile }: { disponibile: boolean; percorsoFile: string }) {
  return (
    <section className="border-t border-white/5">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <SectionHeading eyebrow="La brochure" title="Tutto KIREO in poche pagine" align="center" />
        <div className="mt-10">
          {disponibile ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href={percorsoFile}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-kireo-green px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:bg-kireo-green-light"
              >
                Sfoglia la brochure
              </a>
              <a
                href={percorsoFile}
                download
                className="inline-flex items-center justify-center rounded-full border border-kireo-light/30 px-6 py-3 font-sans text-sm font-semibold text-kireo-light transition-colors hover:border-kireo-light/60 hover:bg-white/5"
              >
                Scarica
              </a>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-kireo-card p-8">
              <p className="font-heading text-lg font-semibold text-kireo-light">Brochure in arrivo</p>
              <p className="mt-2 text-sm text-kireo-muted">
                Stiamo preparando un documento riassuntivo da sfogliare o scaricare. Nel frattempo, le informazioni
                principali sono tutte in questa pagina.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
