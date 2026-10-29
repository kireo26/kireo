// LO SCARICAMENTO DI UNA GUIDA PASSA DAL SERVER (29/10), e questo è quello che
// le due route (`/api/scarica-guida/ente/[guidaId]`, `/api/scarica-guida/area/
// [areaSlug]`) e il form (`components/ScaricaGuidaForm.tsx`) hanno in comune.
// Solo funzioni pure: il form le importa nel browser. L'invio dell'email sta in
// `lib/guide/emailGuida.ts`, che è solo del server.
//
// ⚠️ PERCHÉ NON NEL BROWSER. Fino al 29/10 i due form facevano
// `window.location.href = pdf` e DOPO, dietro un `await getSession()`, la
// scrittura della traccia. Quando il PDF sostituisce la pagina (Chrome sul
// computer con un PDF in linea) quella scrittura non parte: misurato in
// simulazione (5 su 5 per l'ente; per le guide d'area dipende da quanto dura
// la lettura della sessione, 0 su 3 a 30 ms) e da Mario in produzione su un
// account vero. Qui la traccia si scrive PRIMA di rispondere con il file:
// l'ordine non dipende più da cosa fa il browser con un PDF.
//
// ⚠️ IL FORM CHIEDE SOLO QUELLO CHE USIAMO (Mario, 29/10). Di un visitatore
// usiamo l'email (per mandargli il link) e la sua accettazione della privacy;
// nome, cognome e classe li chiedevamo e li buttavamo — la classe non lasciava
// nemmeno il browser. Di chi ha fatto l'accesso abbiamo già l'indirizzo: niente
// form, un bottone. Se torna la tentazione di chiedere un campo «perché può
// servire», la domanda è chi lo legge: un dato che non serve a niente non si
// chiede.

export const CAMPO_RITORNO = "ritorno";

// Il risultato che torna alla pagina, in `?guida=`. Il testo lo dice la pagina
// (`testoEsitoGuida`), qui c'è solo la chiave.
export type EsitoGuida = "errore" | "non_disponibile" | "sostituita" | "dati";

// Il percorso da cui si è partiti, per tornarci con un esito. Solo un percorso
// del sito: un indirizzo intero o un `//host` farebbero di questa route un
// rimbalzo verso fuori.
export function ritornoSicuro(valore: FormDataEntryValue | null | undefined): string {
  if (typeof valore !== "string") return "/";
  if (!valore.startsWith("/") || valore.startsWith("//") || valore.includes("\\")) return "/";
  return valore.split("#")[0];
}

export function conEsito(percorso: string, esito: EsitoGuida): string {
  const [base, query = ""] = percorso.split("?");
  const qs = new URLSearchParams(query);
  qs.set("guida", esito);
  return `${base}?${qs.toString()}#guida`;
}

export function emailValida(valore: unknown): valore is string {
  return typeof valore === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valore.trim());
}

export const CAMPO_MANDA_LINK = "manda_link";

/**
 * Chi riceve il link. Chi ha fatto l'accesso lo riceve all'indirizzo
 * dell'account (il campo del form, se c'è, non conta), e solo se il form lo
 * chiede (`manda_link`): il form della guida lo dice sopra il bottone, il chip
 * «Scarica la guida» della home no, e lì un'email a ogni clic non l'ha chiesta
 * nessuno. Un visitatore deve dare un'email valida e accettare la privacy.
 * `null` vuol dire «nessuna email» (per un visitatore: dati mancanti).
 */
export function destinatarioGuida(emailAccount: string | null | undefined, form: FormData | null): string | null {
  if (emailAccount) return form?.get(CAMPO_MANDA_LINK) === "si" ? emailAccount : null;
  if (!form) return null;
  const email = form.get("email");
  if (!emailValida(email) || form.get("privacy") !== "si") return null;
  return email.trim();
}

export function linkHttp(href: unknown): href is string {
  return typeof href === "string" && /^https?:\/\//i.test(href.trim());
}
