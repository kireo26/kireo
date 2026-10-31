// La riga di ricerca degli elenchi dell'admin: un form GET, niente JavaScript.
// Una ricerca nuova riparte dalla prima pagina.
export default function Ricerca({ base, q, segnaposto }: { base: string; q?: string; segnaposto: string }) {
  return (
    <form method="get" action={base} className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder={segnaposto}
        aria-label={segnaposto}
        className="w-full rounded-lg border border-white/10 bg-kireo-dark px-3 py-2 text-sm text-kireo-light placeholder:text-kireo-muted"
      />
      <button type="submit" className="rounded-lg bg-kireo-green px-4 py-2 text-sm font-semibold text-white hover:bg-kireo-green-light">
        Cerca
      </button>
    </form>
  );
}
