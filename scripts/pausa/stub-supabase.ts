// Stub del client Supabase per il banco della pausa: il pannello legge la
// propria riga di `presenze_live`; qui rispondiamo col numero di battiti che
// il banco ha visto arrivare, così il contatore a schermo si comporta come in
// produzione. Nessuna rete verso Supabase.
type Risposta = { data: unknown; error: null };
declare global { interface Window { __battiti?: number; __rpc?: string[] } }
function catena(): unknown {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in", "gte", "lte"]) c[m] = () => c;
  c.maybeSingle = async (): Promise<Risposta> => ({ data: { ping_totali: window.__battiti ?? 0 }, error: null });
  c.single = c.maybeSingle;
  c.then = (r: (v: Risposta) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
  return c;
}
export function createClient() {
  return {
    from: () => catena(),
    rpc: async (nome: string) => {
      (window.__rpc ??= []).push(nome);
      return { data: [], error: null };
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: "u" } } }, error: null }) },
  };
}
