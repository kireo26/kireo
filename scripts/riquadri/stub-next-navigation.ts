// `router.refresh()` rilegge le props dal server finto (window.__refresh, vedi
// ingresso.tsx): è il gesto con cui, in produzione, un riquadro aggiorna l'altro.
declare global { interface Window { __refresh?: () => void } }
export function usePathname() { return "/diretta/e"; }
export function useRouter() { return { push() {}, replace() {}, refresh() { window.__refresh?.(); } }; }
