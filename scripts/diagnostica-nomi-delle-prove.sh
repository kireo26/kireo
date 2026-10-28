#!/usr/bin/env bash
# Il quattordicesimo modo, misurato eseguendo (28/10): ricostruisce la replica,
# la strumenta (scripts/diagnostica-nomi-delle-prove.sql), lancia ogni
# scripts/verifica-*.sql e confronta i titoli con chi il database ha visto agire.
# Alla fine RICOSTRUISCE la replica pulita: una replica strumentata ha un
# auth.uid() diverso da quello della produzione, e non deve restare in giro.
# Uso: scripts/diagnostica-nomi-delle-prove.sh   (stessa replica di replica-locale.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=(psql -h /tmp -p "${PGPORT:-54329}" -U postgres -d postgres -X -q -P pager=off)
scripts/replica-locale.sh >/dev/null
"${PSQL[@]}" -v ON_ERROR_STOP=1 -f scripts/diagnostica-nomi-delle-prove.sql
USCITA=$(mktemp)
for f in scripts/verifica-*.sql; do
  "${PSQL[@]}" -f "$f" 2>&1 | grep -o 'SONDA|.*' | sed "s|^|$(basename "$f")|" >>"$USCITA" || true
done
node scripts/diagnostica-nomi-delle-prove.js "$USCITA"
scripts/replica-locale.sh >/dev/null
echo "(replica ricostruita pulita; righe grezze in $USCITA)"
