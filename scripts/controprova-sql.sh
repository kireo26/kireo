#!/usr/bin/env bash
# UNA CONTROPROVA SQL DICHIARA QUALE ROSSO ASPETTA (28/10, Mario).
#
# *Un rosso qualunque non è una conferma, è una coincidenza.* Una replica
# preparata male fa morire lo script al primo comando, e quel «rosso» sembra
# la controprova riuscita. Qui la controprova dice PRIMA quali proprietà devono
# diventare rosse, e il giudizio ha quattro esiti:
#   ✓ RIUSCITA      sono rosse esattamente quelle, e le altre sono verdi;
#   ✗ SBAGLIATA     è rossa una che non doveva, o è verde una che doveva essere rossa;
#   ✗ NON PARTITA   lo script non ha stampato nessuna proprietà: non ha guardato niente;
#   ? NON SI PUÒ    lo script non numera le proprietà, quindi il rosso non si attribuisce.
# Solo il primo è una conferma.
#
# Uso, su una replica NATA SENZA la cosa che si prova (vedi «Una controprova su
# uno stato che il fix ha già creato non prova il fix»):
#   FERMA_PRIMA=20261108110000 scripts/controprova-sql.sh scripts/verifica-x.sql 2,3
#   CONN="…" scripts/controprova-sql.sh scripts/verifica-x.sql 2,3
set -uo pipefail
RADICE="$(cd "$(dirname "$0")/.." && pwd)"
f="${1:?uso: controprova-sql.sh <script.sql> <rosse attese, es. 2,3>}"
attese_rosse="$(echo "${2:?mancano le rosse attese}" | tr ',' '\n' | grep -E '^[0-9]+$' | sort -u)"
[ -n "$attese_rosse" ] || { echo "? l'elenco delle rosse attese è vuoto: una controprova senza rosso atteso non prova niente" >&2; exit 2; }
CONN="${CONN:-}"
if [ -z "$CONN" ]; then
  [ -n "${FERMA_PRIMA:-}" ] || { echo "? serve CONN o FERMA_PRIMA: una controprova gira su una replica nata senza la cosa che prova" >&2; exit 2; }
  CONN="$("$RADICE/scripts/replica-locale.sh" | tail -1)" || { echo "replica non costruita" >&2; exit 2; }
fi
OUT="$(mktemp)"
psql "$CONN" -P pager=off -f "$f" >"$OUT" 2>&1

scritte=$(tr '\n' ' ' <"$f" | grep -oE 'esiti[[:space:]]+(values[[:space:]]*\(|select)[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' | sort -u)
[ -n "$scritte" ] || { echo "? NON SI PUÒ: $(basename "$f") non numera le proprietà, il rosso non si attribuisce"; exit 2; }
stampate=$(grep -oE '^[[:space:]]*[0-9]+[[:space:]]*\|' "$OUT" | tr -dc '0-9\n' | sort -u)
if [ -z "$stampate" ]; then
  echo "✗ NON PARTITA: $(basename "$f") non ha stampato nessuna proprietà. Non è una conferma."
  grep -m1 ERROR "$OUT" | sed 's/^/    /'
  exit 2
fi
rosse=$(grep -E '^[[:space:]]*[0-9]+[[:space:]]*\|' "$OUT" | grep -E '\bROTT[AOE]\b|\|[[:space:]]+f[[:space:]]*$' | grep -oE '^[[:space:]]*[0-9]+' | tr -dc '0-9\n' | sort -u)
mancanti=$(comm -23 <(echo "$scritte") <(echo "$stampate") | tr '\n' ' ')
inattese=$(comm -13 <(echo "$attese_rosse") <(echo "$rosse") | tr '\n' ' ')
non_arrivate=$(comm -23 <(echo "$attese_rosse") <(echo "$rosse") | tr '\n' ' ')
if [ -z "${inattese// /}" ] && [ -z "${non_arrivate// /}" ] && [ -z "${mancanti// /}" ]; then
  echo "✓ RIUSCITA: rosse esattamente $(echo $rosse | tr ' ' ','), verdi le altre ($(echo "$stampate" | wc -l) stampate)"
  exit 0
fi
echo "✗ SBAGLIATA ($(basename "$f"))"
[ -n "${non_arrivate// /}" ] && echo "    attese rosse e arrivate verdi: $non_arrivate"
[ -n "${inattese// /}" ] && echo "    rosse e non attese: $inattese"
[ -n "${mancanti// /}" ] && echo "    scritte e non stampate: $mancanti"
exit 1
