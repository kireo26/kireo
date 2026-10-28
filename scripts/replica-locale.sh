#!/usr/bin/env bash
# UNA REPLICA LOCALE DA ZERO (26/10): Postgres 16 nudo + `scripts/replica-shim.sql`
# + tutte le migrazioni in ordine, una transazione per file (un valore enum
# appena creato non si usa nella stessa transazione). Le tre di Storage si
# saltano: qui Storage non c'è. Lo schema `storage` esiste dal 28/10, ma è vuoto:
# lo crea lo shim solo per imitare la riga dei privilegi predefiniti che
# `postgres` ha lì in produzione (vedi `scripts/replica-shim.sql`).
#
# Fino al 26/10 questa sequenza veniva ricostruita a mano a ogni sessione. Il
# copione esiste perché `scripts/verifica-sql-tutti.sh` possa lanciare TUTTI gli
# script SQL su una replica pulita — e perché due replica costruite in due
# giorni diversi siano la stessa replica.
#
# Uso: scripts/replica-locale.sh [cartella] [porta]   (default: /tmp/kireo-replica 54329)
#      FERMA_PRIMA=<prefisso> scripts/replica-locale.sh → si ferma PRIMA della
#      migrazione con quel prefisso (27/10): serve a provare una migrazione che
#      trasforma righe che esistono già, seminandole e applicandola a mano.
# Stampa la stringa di connessione sull'ultima riga.
set -euo pipefail
DIR="${1:-/tmp/kireo-replica}"
PORTA="${2:-54329}"
BIN=/usr/lib/postgresql/16/bin
RADICE="$(cd "$(dirname "$0")/.." && pwd)"

# Prima si ferma un server rimasto in piedi su quella cartella: cancellare la
# cartella sotto un server vivo lascia un Postgres che risponde su un dato che
# non c'è più, e il giro dopo «non dà output» — che somiglia a un verde.
if [ -f "$DIR/postmaster.pid" ]; then su postgres -c "$BIN/pg_ctl -D $DIR -m immediate stop" >/dev/null 2>&1 || true; fi
rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres "$DIR"
su postgres -c "$BIN/initdb -D $DIR -A trust -U postgres" >/dev/null
su postgres -c "$BIN/pg_ctl -D $DIR -o '-p $PORTA -k /tmp' -l $DIR/log -w start" >/dev/null
CONN="host=/tmp port=$PORTA user=postgres dbname=postgres"
psql "$CONN" -q -v ON_ERROR_STOP=1 -f "$RADICE/scripts/replica-shim.sql" >/dev/null
for f in "$RADICE"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in *storage*) continue ;; esac
  if [ -n "${FERMA_PRIMA:-}" ] && [[ "$(basename "$f")" == "$FERMA_PRIMA"* ]]; then break; fi
  if ! psql "$CONN" -q -v ON_ERROR_STOP=1 --single-transaction -f "$f" >/dev/null 2>"$DIR/errore.txt"; then
    echo "MIGRAZIONE FALLITA: $(basename "$f")" >&2; cat "$DIR/errore.txt" >&2; exit 1
  fi
done
echo "$CONN"
