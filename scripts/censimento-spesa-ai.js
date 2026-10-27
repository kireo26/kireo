// IL CENSIMENTO DELLE ROUTE CHE SPENDONO (Mario, 27/10): quali ingressi di
// `app/` arrivano, per import, a una chiamata a un modello a pagamento.
//
// Metodo: per ogni route.ts / page.tsx / actions.ts sotto app/ si segue la
// chiusura delle import (solo «@/…» e relative) finché si arriva al SDK di
// Anthropic o a uno dei file di lib/ che lo chiamano. Stampa la catena.
//
// Sbaglia per ECCESSO, ed è il verso che si legge come tetto: un file che
// importa solo una costante da un file che spende risulta «spende» (il caso
// vero: la pagina della diretta importa i limiti di caratteri da
// lib/eventi/consegna.ts). Ogni riga va letta. NON vede una spesa che passa da
// una coda: `consegna-tappa` non chiama un modello, ma prepara il lavoro che il
// cron pagherà.
//
// Non è una suite (non sta in `npm test`): dice dove guardare, non cosa c'è.
// Uso: npm run censimento:spesa
const fs=require('fs'),path=require('path');
const ROOT=process.cwd();
const SPENDE=new Set(['lib/ai/chiamaJson.ts','lib/escape/chiamaEscape.ts','lib/escape/scoring.ts','lib/eventi/consegna.ts']);
function risolvi(da,spec){let b;if(spec.startsWith('@/'))b=path.join(ROOT,spec.slice(2));else if(spec.startsWith('.'))b=path.resolve(path.dirname(da),spec);else return null;
for(const e of ['','.ts','.tsx','/index.ts','/index.tsx'])if(fs.existsSync(b+e)&&fs.statSync(b+e).isFile())return b+e;return null;}
const memo=new Map();
function spende(f,vis=new Set()){const r=path.relative(ROOT,f);if(SPENDE.has(r))return [r];if(vis.has(f))return null;vis.add(f);
const src=fs.readFileSync(f,'utf8');if(/@anthropic-ai\/sdk|api\.anthropic\.com/.test(src))return [r];
for(const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)){const d=risolvi(f,m[1]);if(!d)continue;const c=spende(d,vis);if(c)return [r,...c];}return null;}
function walk(d,o=[]){for(const x of fs.readdirSync(d)){const p=path.join(d,x);if(fs.statSync(p).isDirectory())walk(p,o);else if(/^(route|page)\.tsx?$/.test(x)||/actions?\.ts$/.test(x))o.push(p);}return o;}
const tutti=walk(path.join(ROOT,'app'));
let n=0;for(const f of tutti){const c=spende(f);if(c){n++;console.log(c.join(' → '));}}
console.log('file di ingresso guardati:',tutti.length,' che arrivano a un modello:',n);
