// Stub del client Supabase per il banco dei due riquadri. Un SERVER FINTO
// (window.__server) tiene lo stato dell'evento, e le quattro funzioni rispondono
// su quello. Le ore si ricalcolano qui con la formula per difetto: è il banco
// che fa da database, non una copia nel prodotto (il prodotto non la ha).
//
// `window.__trattieni = true` tiene in sospeso le anteprime finché il banco non
// chiama `window.__rilascia()`: è così che si guarda il riquadro MENTRE rilegge.
type Server = { inizio: string; fine: string | null; ore: number | null; fissate: string | null; chiusa: string | null };
type Chiamata = { nome: string; args: Record<string, unknown> };
declare global {
  interface Window {
    __server: Server;
    __chiamate: Chiamata[];
    __trattieni?: boolean;
    __inSospeso?: (() => void)[];
    __rilascia: () => void;
  }
}
window.__chiamate = [];
window.__rilascia = () => {
  const l = window.__inSospeso ?? [];
  window.__inSospeso = [];
  l.forEach((f) => f());
};
const ore = (i: string, f: string | null) => (f ? Math.floor(((new Date(f).getTime() - new Date(i).getTime()) / 60000 / 60) * 100) / 100 : null);
type Risposta = { data: unknown; error: { message: string } | null };
function anteprima(r: () => Risposta): Promise<Risposta> {
  if (!window.__trattieni) return Promise.resolve(r());
  return new Promise((ok) => (window.__inSospeso ??= []).push(() => ok(r())));
}
export function createClient() {
  return {
    rpc: (nome: string, args: Record<string, unknown>): Promise<Risposta> => {
      window.__chiamate.push({ nome, args });
      const s = window.__server;
      if (nome === "anteprima_correzione_ore") {
        return anteprima(() => {
          const durata = s.fine ? Math.floor((new Date(s.fine).getTime() - new Date(s.inizio).getTime()) / 60000) : null;
          return { data: [{ durata_minuti: durata, massimo: durata === null ? null : Math.floor((durata / 60) * 100) / 100, chiusa: s.chiusa !== null, ha_fine: s.fine !== null }], error: null };
        });
      }
      if (nome === "anteprima_spostamento_finestra") {
        return anteprima(() => ({
          data: [{ ore_attuali: s.ore, ore_nuove: ore(String(args.p_data_inizio), String(args.p_data_fine)), fissate_a_mano: s.fissate !== null, aveva_fine: s.fine !== null }],
          error: null,
        }));
      }
      if (nome === "correggi_ore_evento") {
        s.ore = Number(args.p_ore);
        s.fissate = "2026-12-01T09:00:00Z";
        return Promise.resolve({ data: null, error: null });
      }
      if (nome === "sposta_finestra_evento") {
        // La regola di `20261030100000`: senza i tre valori visti la chiamata
        // non esiste (nessun default), e se sono cambiati è `stato_cambiato`.
        if (!("p_ore_viste" in args) || !("p_fissate_viste" in args) || !("p_aveva_fine_vista" in args)) {
          return Promise.resolve({ data: null, error: { message: "Could not find the function public.sposta_finestra_evento with 3 arguments" } });
        }
        const viste = args.p_ore_viste === null ? null : Number(args.p_ore_viste);
        if (viste !== s.ore || args.p_fissate_viste !== (s.fissate !== null) || args.p_aveva_fine_vista !== (s.fine !== null)) {
          return Promise.resolve({ data: null, error: { message: "stato_cambiato" } });
        }
        s.inizio = String(args.p_data_inizio);
        s.fine = String(args.p_data_fine);
        s.ore = ore(s.inizio, s.fine);
        s.fissate = null;
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `rpc sconosciuta ${nome}` } });
    },
  };
}
