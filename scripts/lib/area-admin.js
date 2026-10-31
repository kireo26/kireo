// Il sorgente di tutta l'area admin (app/admin e components/admin), senza
// commenti, per le guardie che dicono «in /admin non c'è X» (31/10).
//
// Fino al riordino quelle guardie leggevano la sola app/admin/page.tsx: con la
// pagina divisa in dieci, una negazione su quel file sarebbe rimasta verde
// perché il file non contiene più quasi niente. Un divieto sull'area si legge
// sull'area. Restituisce anche quanti file ha letto, per un pavimento.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./senza-commenti");

const ROOT = path.join(__dirname, "..", "..");

function elenca(dir, out = []) {
  const assoluta = path.join(ROOT, dir);
  if (!fs.existsSync(assoluta)) return out;
  for (const e of fs.readdirSync(assoluta, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) elenca(rel, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

function sorgentiAreaAdmin() {
  const file = [...elenca("app/admin"), ...elenca("components/admin")];
  const testo = file.map((f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"))).join("\n");
  return { file: file.map((f) => f.split(path.sep).join("/")), testo };
}

module.exports = { sorgentiAreaAdmin };
