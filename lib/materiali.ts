import { existsSync } from "fs";
import path from "path";

// Verifica se un materiale (es. una brochure PDF) esiste davvero in
// public/materiali/, invece di affidarsi a un flag manuale che potrebbe
// disallinearsi: caricare il file al percorso giusto attiva la sezione da
// solo, senza bisogno di toccare il codice. Server-only (fs), da chiamare
// solo da Server Component o Route Handler.
export function materialeDisponibile(nomeFile: string): boolean {
  return existsSync(path.join(process.cwd(), "public", "materiali", nomeFile));
}
