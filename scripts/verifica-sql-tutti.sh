#!/usr/bin/env bash
# TUTTI GLI SCRIPT SQL, SU UNA REPLICA PULITA, IN UN COLPO (26/10).
#
# `scripts/verifica-completamento-ritiro.sql` è stato rosso dal 20/09 al 26/10
# e non se n'è accorto nessuno: gli script SQL non sono in `npm test` (servono
# un Postgres) e si lanciavano «quando serve» — cioè quando si tocca la cosa
# che provano, che è esattamente il momento in cui un rosso causato DA ALTRO
# non si vede. Fino a un giro di questo, ogni «verde» di quel gruppo valeva
# quanto un «non ho guardato».
#
# Uso: scripts/verifica-sql-tutti.sh            → ricostruisce la replica e lancia
#      CONN="…" scripts/verifica-sql-tutti.sh   → usa una replica già in piedi
#
# TRE ESITI, e il terzo non è un verde: ROSSA (uscita non zero, oppure una riga
# che dice ✗/ROTTA/ROTTO, oppure un booleano `f` in fondo a una riga di
# tabella); VERDE; DA LEGGERE (gli script di sola diagnostica, che non
# affermano niente: stampano qualcosa da confrontare a mano).
#
# ⚠️ UN `ERROR:` NELL'USCITA È UN ROSSO (27/10). Tre script cominciano con
# `\set ON_ERROR_STOP off`, quindi un comando che fallisce fuori da un blocco
# protetto non cambia l'uscita: la transazione abortisce, ogni comando dopo
# viene ignorato, lo script non stampa nessun risultato, e «zero righe rosse»
# lo contava verde. È successo il 27/10 a `verifica-scrittura-dal-client.sql`,
# morto alla riga 130 sotto la migrazione 20261105100000 (il modo 2 nel
# lanciatore: verde su zero righe). Misurato prima di scrivere la regola: su una
# replica senza quella migrazione nessuno dei 44 script stampa un `ERROR:` di
# primo livello, quindi oggi la regola non ha falsi positivi. Un errore
# ATTESO si cattura dentro un `do $$ … exception … end $$`, che non lo stampa.
#
# ⚠️ ROSSO PERCHÉ È CADUTA UNA PROPRIETÀ ≠ ROSSO PERCHÉ NON È PARTITO NIENTE
# (28/10, Mario). Uno script con proprietà numerate che non ne stampa nessuna
# non ha guardato niente: è morto prima (una fixture rotta, una replica
# preparata male, una tabella che non c'è). Si conta a parte, «NON PARTITO»:
# resta un rosso del giro, ma non si legge mai come la conferma di una
# controprova. *Un rosso che arriva perché niente è partito non dimostra che
# qualcosa stava guardando.* Per le controprove c'è scripts/controprova-sql.sh,
# che pretende di sapere QUALI proprietà devono diventare rosse.
set -uo pipefail
RADICE="$(cd "$(dirname "$0")/.." && pwd)"
CONN="${CONN:-}"
if [ -z "$CONN" ]; then
  CONN="$("$RADICE/scripts/replica-locale.sh" | tail -1)" || { echo "replica non costruita" >&2; exit 2; }
fi
OUT="$(mktemp -d)"

# LE COLONNE DEL CLIENT SULLA REPLICA (28/10), PRIMA degli script, su una replica
# che nessuno ha ancora toccato: è la metà di `npm run test:colonne` che guarda i
# privilegi veri invece delle migrazioni (§5). Un rosso qui ferma il giro.
echo "colonne del client, sulla replica:"
if ! CONN="$CONN" node "$RADICE/scripts/verifica-colonne-del-client.js" >"$OUT/colonne.out" 2>&1; then
  grep -E '✗|→' "$OUT/colonne.out" | head -6 | sed 's/^/  /'
  echo "  ✗ verifica-colonne-del-client (uscita in $OUT/colonne.out)"; COLONNE_ROSSE=1
else
  echo "  ✓ $(tail -1 "$OUT/colonne.out")"; COLONNE_ROSSE=0
fi

# LE COLONNE DELL'EXPORT SULLA REPLICA (29/10): la metà di `npm run test:export`
# che confronta le colonne lette dalle migrazioni con il catalogo vero (§10).
echo "colonne dell'export, sulla replica:"
if ! CONN="$CONN" node "$RADICE/scripts/verifica-export-dati.js" >"$OUT/export.out" 2>&1 || ! grep -q "sulla replica le colonne" "$OUT/export.out"; then
  grep -E '✗|ROSSA' "$OUT/export.out" | head -6 | sed 's/^/  /'
  echo "  ✗ verifica-export-dati (uscita in $OUT/export.out)"; COLONNE_ROSSE=1
else
  echo "  ✓ $(grep "sulla replica le colonne" "$OUT/export.out" | sed 's/^ *ok *//')"
fi

# Diagnostica, non asserzioni: il perché accanto a ognuno.
declare -A DIAGNOSTICA=(
  [verifica-cascata-profili]="stampa la chiusura della cascata da confrontare con scripts/lib/cascata-profili.js"
  [verifica-flag-di-prova]="stampa i profili marcati di prova; da leggere sul database vero"
)

rosse=0; verdi=0; leggere=0; tot=0; con_numeri=0; non_partiti=0
for f in "$RADICE"/scripts/verifica-*.sql; do
  n="$(basename "$f" .sql)"; tot=$((tot + 1))
  psql "$CONN" -v ON_ERROR_STOP=1 -P pager=off -f "$f" >"$OUT/$n.out" 2>&1
  e=$?
  segni=$(grep -E '✗|\bROTT[AOE]\b|\bROSS[AOE]\b|\|[[:space:]]+f[[:space:]]*$|ERROR:' "$OUT/$n.out" | grep -vcE '\b0 ROTTE\b')
  # ⚠️ UNA PROPRIETÀ SCRITTA NEL SORGENTE E ASSENTE DALL'USCITA È UN ROSSO (27/10):
  # `verifica-esente-dai-cancelli` §3 scriveva il proprio esito con un
  # `select … from` su una riga che la cura aveva impedito, e spariva senza un
  # errore. L'estrattore vede solo le forme `esiti values (N` / `esiti select N` (anche su due righe),
  # quindi sbaglia per difetto (un numero scritto in un'altra forma non lo
  # cerca); misurato il 27/10, nessuno script ha oggi un numero del sorgente
  # che manca dall'uscita.
  # Le righe si uniscono prima di cercare: `insert into esiti` e `select 14, …`
  # stanno spesso su due righe, ed è proprio la forma che sparisce (il primo
  # estrattore guardava una riga sola, e la controprova sul §14 di
  # verifica-quattro-colonne non mordeva).
  attese=$(tr '\n' ' ' <"$f" | grep -oE 'esiti[[:space:]]+(values[[:space:]]*\(|select)[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' | sort -u)
  partito=1
  if [ -n "$attese" ]; then
    con_numeri=$((con_numeri + 1))
    stampate=$(grep -oE '^[[:space:]]*[0-9]+[[:space:]]*\|' "$OUT/$n.out" | tr -dc '0-9\n' | sort -u)
    mancanti=$(comm -23 <(echo "$attese") <(echo "$stampate") | tr '\n' ' ')
    if [ -z "$stampate" ]; then
      partito=0
    elif [ -n "${mancanti// /}" ]; then
      segni=$((segni + 1)); echo "      proprietà scritte e non stampate: $mancanti" >>"$OUT/$n.out"
    fi
  fi
  if [ "$partito" -eq 0 ]; then
    rosse=$((rosse + 1)); non_partiti=$((non_partiti + 1))
    echo "  ✗ $n  NON PARTITO: nessuna delle sue proprietà è stata stampata (non ha guardato niente)"
    grep -m1 -E 'ERROR' "$OUT/$n.out" | sed 's/^/      /'
  elif [ $e -ne 0 ] || [ "$segni" -gt 0 ]; then
    rosse=$((rosse + 1)); echo "  ✗ $n  (uscita $e, $segni righe rosse)"
    grep -E 'ERROR|✗|\bROTT[AOE]\b|\bROSS[AOE]\b|\|[[:space:]]+f[[:space:]]*$|scritte e non stampate' "$OUT/$n.out" | grep -vE '\b0 ROTTE\b' | head -3 | sed 's/^/      /'
  elif [ -n "${DIAGNOSTICA[$n]:-}" ]; then
    leggere=$((leggere + 1)); echo "  ? $n  — da leggere: ${DIAGNOSTICA[$n]}"
  else
    verdi=$((verdi + 1)); echo "  ✓ $n"
  fi
done
echo
echo "$tot script: $verdi verdi, $rosse rossi (di cui $non_partiti non partiti), $leggere di sola diagnostica (uscite in $OUT)"
# La soglia: sotto venti script l'elenco non sta leggendo la cartella.
[ "$tot" -ge 20 ] || { echo "✗ solo $tot script trovati: il lanciatore non sta leggendo la cartella" >&2; exit 1; }
# E sotto venticinque script con proprietà numerate l'estrattore non le sta vedendo
# (il 27/10 sono 34 su 45): il controllo qui sopra sarebbe verde su niente.
echo "(proprietà numerate confrontate col sorgente in $con_numeri script)"
[ "$con_numeri" -ge 25 ] || { echo "✗ solo $con_numeri script con proprietà numerate: l'estrattore non le sta vedendo" >&2; exit 1; }
[ "$rosse" -eq 0 ] && [ "$COLONNE_ROSSE" -eq 0 ]
