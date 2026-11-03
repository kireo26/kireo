// La registrazione consulta le lapidi (03/11). Chi ha firmato anche una cosa
// sola e ha cancellato l'account lascia l'indirizzo in `indirizzi_delle_lapidi`,
// e quell'indirizzo non si registra più (decisione di Mario). Il trigger su
// `auth.users` lo rifiuta comunque, ma Supabase lo restituirebbe come un errore
// generico («riprova»): per questo si chiede PRIMA, e si dice la regola.
//
// ⚠️ La frase non deve assomigliare a «account già esistente»: manderebbe
// quella persona a cercare una password che non esiste più (Mario). Mia e
// provvisoria.
//
// Una domanda che non arriva (o oltre il tetto di 10 in un'ora per rete, 429)
// risponde `null`, e la registrazione prosegue: se
// l'indirizzo era di una lapide la ferma il trigger, con un errore peggio
// scritto ma senza che niente si scriva.

export const TESTO_INDIRIZZO_CANCELLATO =
  "Questo indirizzo era di un account cancellato, e non può essere usato di nuovo per registrarsi. Se è il tuo, scrivici da Contatti.";

export async function indirizzoDiUnAccountCancellato(email: string): Promise<boolean | null> {
  try {
    const r = await fetch("/api/registrazione/indirizzo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { cancellato?: unknown };
    return typeof d.cancellato === "boolean" ? d.cancellato : null;
  } catch {
    return null;
  }
}
