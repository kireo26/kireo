import Schede from "@/components/admin/Schede";

// I POST DEGLI ENTI (31/10). Tutti · Pubblicati · Tolti: i post non hanno più
// un'approvazione dal 29/10 — si pubblicano subito e l'admin li toglie — e
// un filtro «da approvare» insegnerebbe all'admin una regola che non esiste.
export default function AdminPostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light">Post</h1>
      <Schede
        etichetta="Post"
        schede={[
          { href: "/admin/post", label: "Tutti" },
          { href: "/admin/post/pubblicati", label: "Pubblicati" },
          { href: "/admin/post/tolti", label: "Tolti" },
        ]}
      />
      {children}
    </div>
  );
}
