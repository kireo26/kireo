// La sessione del browser, per il form di un'area: la decide window.__props.
export function createClient() {
  return {
    auth: {
      async getSession() {
        const e = (window as unknown as { __props: { emailAccount: string | null } }).__props.emailAccount;
        return { data: { session: e === null ? null : { user: { email: e } } } };
      },
    },
  };
}
