import SectionHeading from "@/components/SectionHeading";

// Player YouTube (dominio youtube-nocookie.com, niente cookie di
// tracciamento non essenziali) pilotato da un id video passato dalla
// pagina chiamante. Finché l'id è null, mostra un riquadro onesto "in
// arrivo" invece di un player rotto — nessun placeholder che promette un
// video che non esiste ancora.
export default function VideoPresentazione({ videoId, titolo }: { videoId: string | null; titolo: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <SectionHeading eyebrow="Il video" title={titolo} align="center" />
      <div className="mt-10">
        {videoId ? (
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/5">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={titolo}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/5 bg-kireo-card text-center">
            <p className="font-heading text-lg font-semibold text-kireo-light">Video di presentazione in arrivo</p>
            <p className="mt-2 max-w-sm text-sm text-kireo-muted">
              Stiamo preparando un video che racconta KIREO in pochi minuti. Nel frattempo trovi tutte le informazioni
              qui sotto.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
