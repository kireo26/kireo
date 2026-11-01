// CHI SEI, SCRITTO DOVE LO SI GUARDA (Mario, 01/11).
//
// Per due giorni abbiamo chiamato «test11» degli schermi che erano di test7:
// nell'area dello studente non c'era scritto da nessuna parte con quale account
// si era entrati, mentre l'area dell'ente ha il suo nome in testa alla barra.
// Non è una comodità per chi prova: è lo stesso problema di uno studente che
// apre KIREO sul telefono della madre, dove è collegata lei, o di chi ha un
// account vecchio e uno nuovo. *Uno schermo senza il nome dell'account è una
// prova senza soggetto* (regola del 28/10), e il prodotto deve aiutare a
// rispettarla.
//
// ⚠️ L'EMAIL C'È SEMPRE, NON SOLO IL NOME: i due account di Mario si chiamano
// tutti e due «Mario Izzo». Il nome dice chi sei per gli altri, l'email dice
// quale account è. Si mostra a chi è collegato, quindi a chi la conosce già.
//
// ⚠️ Niente «sei entrato come»: accorda col genere di chi legge (la lingua di
// KIREO). Il nome e l'email bastano da soli.

import { righeAccount, type Account } from "@/lib/app/account";

export type { Account };

export default function AccountInUso({ account, compatto = false }: { account: Account; compatto?: boolean }) {
  const { principale, secondaria } = righeAccount(account);
  if (!principale) return null;
  if (compatto) {
    // Sul telefono, sotto il nome della sezione: l'email, che è quella che
    // distingue (il nome da solo non distingue due account omonimi).
    const riga = account.email?.trim() || principale;
    return (
      <span className="block truncate text-xs text-kireo-muted" title={riga}>
        <span className="sr-only">Account: </span>
        {riga}
      </span>
    );
  }
  return (
    <div className="px-2 pb-6" title={secondaria ?? principale}>
      <p className="sr-only">Account:</p>
      <p className="truncate text-sm font-medium text-kireo-light">{principale}</p>
      {secondaria && <p className="truncate text-xs text-kireo-muted">{secondaria}</p>}
    </div>
  );
}
