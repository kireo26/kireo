import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getFeedBacheca, POST_PER_PAGINA } from "@/lib/app/bacheca";
import FeedPost from "@/components/app/FeedPost";

export default async function BachecaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina: paginaParam } = await searchParams;
  const paginaZeroBased = Math.max(0, (Number(paginaParam) || 1) - 1);

  const contesto = await getAppContext();
  const supabase = await createClient();

  const { post, totale } = await getFeedBacheca(supabase, contesto.userId, paginaZeroBased);
  const totalePagine = Math.max(1, Math.ceil(totale / POST_PER_PAGINA));

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Bacheca</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Novità dagli enti che segui</h1>
      </div>

      {post.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
          <p className="text-kireo-muted">
            Non segui ancora nessun ente, oppure chi segui non ha ancora pubblicato nulla. Esplora i profili delle
            istituzioni dalle pagine{" "}
            <Link href="/per-gli-studenti" className="text-kireo-orange underline underline-offset-2">
              Aree di orientamento
            </Link>{" "}
            e inizia a seguirle.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {post.map((p) => (
              <FeedPost key={p.id} post={p} />
            ))}
          </ul>

          {totalePagine > 1 && (
            <div className="flex items-center justify-center gap-4">
              {paginaZeroBased > 0 && (
                <Link href={`/app/bacheca?pagina=${paginaZeroBased}`} className="text-sm text-kireo-orange underline underline-offset-2">
                  ← Precedente
                </Link>
              )}
              <span className="text-xs text-kireo-muted">
                Pagina {paginaZeroBased + 1} di {totalePagine}
              </span>
              {paginaZeroBased + 1 < totalePagine && (
                <Link href={`/app/bacheca?pagina=${paginaZeroBased + 2}`} className="text-sm text-kireo-orange underline underline-offset-2">
                  Successiva →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
