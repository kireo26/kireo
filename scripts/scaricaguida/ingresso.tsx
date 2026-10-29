// I due form VERI della guida, montati in Chromium: quello dell'ente (che la
// pagina rende dal server con l'indirizzo dell'account) e quello di un'area
// (che la sessione la legge nel browser). Quale, e con quale account, lo dice
// window.__props.
import { createRoot } from "react-dom/client";
import GuidaEnteForm from "@/components/app/GuidaEnteForm";
import GuidaAreaForm from "@/components/GuidaAreaForm";
const p = (window as unknown as { __props: { quale: "ente" | "area"; emailAccount: string | null } }).__props;
createRoot(document.getElementById("radice")!).render(
  p.quale === "ente"
    ? <GuidaEnteForm guidaId="G1" emailAccount={p.emailAccount} esito={null} />
    : <GuidaAreaForm areaNome="Informatica" areaSlug="informatica-digitale" />,
);
