// Leggere il TypeScript del prodotto da uno script Node.
//
// Serve perché il banco NON duplica i dati del prodotto: le missioni, i test,
// le fasi dei workshop si leggono da `lib/`, dove vivono davvero. Una copia nel
// banco sarebbe una seconda fonte di verità che invecchia in silenzio — e il
// banco esiste proprio per accorgersi delle cose che invecchiano in silenzio.
//
// Due cose sole: risolve gli alias `@/…` come fa Next, e compila i `.ts` al
// volo. Sta in un file suo perché lo usano più comandi, e due copie di un
// registratore di estensioni divergono come qualunque altra coppia.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..", "..");

let fatto = false;

function abilitaTypeScript() {
  if (fatto) return ROOT;
  fatto = true;

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request.startsWith("@/")) {
      const p = path.join(ROOT, request.slice(2));
      for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
    }
    return origResolve.call(this, request, parent, ...rest);
  };

  if (!require.extensions[".ts"]) {
    const compila = function (mod, filename) {
      const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
        fileName: filename,
      });
      return mod._compile(out.outputText, filename);
    };
    require.extensions[".ts"] = compila;
    require.extensions[".tsx"] = compila;
  }

  return ROOT;
}

module.exports = { abilitaTypeScript, ROOT };
