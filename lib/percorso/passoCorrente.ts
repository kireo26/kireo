import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProssimaTappa, type ProssimaTappa } from "./prossimaTappa";
import { passoDiHref, type ChiavePasso } from "./passi";

// Il passo in cui lo studente è ADESSO, per il segno nella barra e per la card
// della home.
//
// UNA CHIAMATA PER RICHIESTA, non due. `getProssimaTappa` fa tre letture, e da
// oggi il risultato lo vogliono in due posti nella stessa pagina: il layout (per
// il segno nella barra) e la home (per la card). Senza `cache()` sarebbero sei
// letture; con `cache()` sono tre — ma solo se il client lo crea QUESTA funzione
// invece di riceverlo, perché `cache()` distingue per argomenti e due
// `createClient()` diversi sono due chiavi diverse. È lo stesso motivo per cui
// `getAppContext` è fatto così.
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
