import Link from "next/link";
import { getAppContext } from "@/lib/app/studentContext";
import { createClient } from "@/lib/supabase/server";
import { getFeedBacheca, leggiCursore } from "@/lib/app/bacheca";
import { TESTI_BACHECA } from "@/lib/app/testiBacheca";
import FeedPost from "@/components/app/FeedPost";

// La Bacheca: i post approvati degli enti che segui, dal più recentemente
// pubblicato. Si scorre con un cursore (`?dopo=`), non con un numero di
// pagina: vedi `lib/app/bacheca.ts`.
export default async function BachecaPage({ searchParams }: { searchParams: Promise<{ dopo?: string }> }) {
  const { dopo } = await searchParams;
  const cursore = leggiCursore(dopo);

  const contesto = await getAppContext();
  const supabase = await createClient();
  const esito = await getFeedBacheca(supabase, contesto.userId, cursore);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">Bacheca</p>
        <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">Novità dagli enti che segui</h1>
      </div>

      {esito.stato === "non_letto" ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-8 text-center">
          <p className="text-amber-200">{TESTI_BACHECA.nonLetta}</p>
        </div>
      ) : esito.stato === "nessun_ente" ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
          <p className="text-kireo-muted">
            {TESTI_BACHECA.nessunEnte}{" "}
            <Link href="/app/esplora" className="text-kireo-orange underline underline-offset-2">
              {TESTI_BACHECA.vaiAEsplora}
            </Link>
          </p>
        </div>
      ) : esito.post.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-kireo-card p-8 text-center">
          <p className="text-kireo-muted">{cursore ? TESTI_BACHECA.finiti : TESTI_BACHECA.nessunPost}</p>
          {cursore && (
            <Link href="/app/bacheca" className="mt-4 inline-block text-sm text-kireo-orange underline underline-offset-2">
              {TESTI_BACHECA.tornaAiRecenti}
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {esito.post.map((p) => (
              <FeedPost key={p.id} post={p} />
            ))}
          </ul>
          <div className="flex items-center justify-center gap-6">
            {cursore && (
              <Link href="/app/bacheca" className="text-sm text-kireo-orange underline underline-offset-2">
                {TESTI_BACHECA.tornaAiRecenti}
              </Link>
            )}
            {esito.cursoreSuccessivo ? (
              <Link
                href={`/app/bacheca?dopo=${encodeURIComponent(esito.cursoreSuccessivo)}`}
                className="text-sm text-kireo-orange underline underline-offset-2"
              >
                {TESTI_BACHECA.piuVecchi}
              </Link>
            ) : (
              <span className="text-xs text-kireo-muted">{TESTI_BACHECA.nienteAltro}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
