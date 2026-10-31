import { RIGHE_PER_PAGINA_ADMIN } from "@/lib/admin/menu";

// GLI ELENCHI DELL'ADMIN DICONO QUANTI SONO (Mario, 31/10): «una schermata che
// mostra le ultime N non è una schermata corta: è una schermata che nasconde,
// e non dice quanto». Ogni elenco scrive il totale e va a pagine.

export function paginaDa(param: string | undefined): number {
  const n = Number.parseInt(param ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function intervallo(pagina: number): { da: number; a: number } {
  const da = (pagina - 1) * RIGHE_PER_PAGINA_ADMIN;
  return { da, a: da + RIGHE_PER_PAGINA_ADMIN - 1 };
}

/** «12 in tutto» o «Mostrati 51–100 di 312». `null` = il totale non si è letto. */
export function testoTotale(totale: number | null, pagina: number, mostrati: number): string {
  if (totale === null) return "Non siamo riusciti a contare quanti sono in tutto.";
  if (totale <= RIGHE_PER_PAGINA_ADMIN) return `In tutto: ${totale}`;
  const da = (pagina - 1) * RIGHE_PER_PAGINA_ADMIN + 1;
  return `Mostrati ${da}–${da + mostrati - 1} di ${totale}`;
}

export function pagineTotali(totale: number | null): number {
  return totale === null ? 1 : Math.max(1, Math.ceil(totale / RIGHE_PER_PAGINA_ADMIN));
}
