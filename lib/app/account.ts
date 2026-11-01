// Le righe di «con quale account sei dentro» (components/app/AccountInUso.tsx,
// dove sta il perché). Qui la regola, pura, perché la si possa provare.

export type Account = { nome: string; email: string | null };

/** Le due righe da mostrare: il nome se c'è, e l'email. Mai due righe uguali,
    mai una riga vuota. */
export function righeAccount(a: Account): { principale: string | null; secondaria: string | null } {
  const nome = a.nome.trim() || null;
  const email = a.email?.trim() || null;
  if (nome && email) return { principale: nome, secondaria: email };
  return { principale: nome ?? email, secondaria: null };
}
