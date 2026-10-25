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
set -uo pipefail
RADICE="$(cd "$(dirname "$0")/.." && pwd)"
CONN="${CONN:-}"
if [ -z "$CONN" ]; then
  CONN="$("$RADICE/scripts/replica-locale.sh" | tail -1)" || { echo "replica non costruita" >&2; exit 2; }
fi
OUT="$(mktemp -d)"

# Diagnostica, non asserzioni: il perché accanto a ognuno.
declare -A DIAGNOSTICA=(
  [verifica-cascata-profili]="stampa la chiusura della cascata da confrontare con scripts/lib/cascata-profili.js"
  [verifica-flag-di-prova]="stampa i profili marcati di prova; da leggere sul database vero"
)

rosse=0; verdi=0; leggere=0; tot=0
for f in "$RADICE"/scripts/verifica-*.sql; do
  n="$(basename "$f" .sql)"; tot=$((tot + 1))
  psql "$CONN" -v ON_ERROR_STOP=1 -P pager=off -f "$f" >"$OUT/$n.out" 2>&1
  e=$?
  segni=$(grep -E '✗|\bROTT[AOE]\b|\|[[:space:]]+f[[:space:]]*$' "$OUT/$n.out" | grep -vcE '\b0 ROTTE\b')
  if [ $e -ne 0 ] || [ "$segni" -gt 0 ]; then
    rosse=$((rosse + 1)); echo "  ✗ $n  (uscita $e, $segni righe rosse)"
    grep -E 'ERROR|✗|\bROTT[AOE]\b|\|[[:space:]]+f[[:space:]]*$' "$OUT/$n.out" | grep -vE '\b0 ROTTE\b' | head -3 | sed 's/^/      /'
  elif [ -n "${DIAGNOSTICA[$n]:-}" ]; then
    leggere=$((leggere + 1)); echo "  ? $n  — da leggere: ${DIAGNOSTICA[$n]}"
  else
    verdi=$((verdi + 1)); echo "  ✓ $n"
  fi
done
echo
echo "$tot script: $verdi verdi, $rosse rossi, $leggere di sola diagnostica (uscite in $OUT)"
# La soglia: sotto venti script l'elenco non sta leggendo la cartella.
[ "$tot" -ge 20 ] || { echo "✗ solo $tot script trovati: il lanciatore non sta leggendo la cartella" >&2; exit 1; }
[ "$rosse" -eq 0 ]
