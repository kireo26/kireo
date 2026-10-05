import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProssimaTappa, type ProssimaTappa } from "./prossimaTappa";
import { passoDiHref, type ChiavePasso } from "./passi";

// Il passo in cui lo studente è ADESSO, per il segno nella barra e per la card
// della home.
//
// UNA CHIAMATA PER RICHIESTA, non due. `getProssimaTappa` fa una DECINA di
// letture (in tre onde parallele), e il risultato lo vogliono in due posti nella
// stessa pagina: il layout (per il segno nella barra) e la home (per la card).
// Senza `cache()` sarebbero il doppio — ma solo se il client lo crea QUESTA
// funzione invece di riceverlo, perché `cache()` distingue per argomenti e due
// `createClient()` diversi sono due chiavi diverse. È lo stesso motivo per cui
// `getAppContext` è fatto così.
//
// ⚠️ IL NUMERO NON SI SCRIVE PRECISO, di proposito. Qui c'era «tre letture», ed
// era vero quando fu scritto: la scala è cresciuta e il commento è rimasto, e
// nessuno se ne accorge rileggendo — il file non è cambiato, è cambiato quello
// che descrive. Un ordine di grandezza dice la cosa che conta (il raddoppio che
// `cache()` evita) e non invecchia a ogni gradino nuovo.
//
// DEGRADA VERSO IL NIENTE. Se la lettura non va, `chiave` resta null: la barra
// non segna nessun passo, invece di segnarne uno a caso. Un segno sbagliato è
// peggio di nessun segno — indica a uno studente un posto in cui non è.
export type PassoCorrente = { tappa: ProssimaTappa | null; chiave: ChiavePasso | null };

export const getPassoCorrente = cache(async (studentId: string): Promise<PassoCorrente> => {
  try {
    const supabase = await createClient();
    const tappa = await getProssimaTappa(supabase, studentId);
    return { tappa, chiave: passoDiHref(tappa.href) };
  } catch (errore) {
    console.error("Errore lettura del passo corrente:", errore);
    return { tappa: null, chiave: null };
  }
});
