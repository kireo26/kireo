#!/bin/bash
export PATH="/Users/marioizzo/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$(dirname "$0")/.."
exec node node_modules/next/dist/bin/next dev --webpack
