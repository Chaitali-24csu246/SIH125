#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)"
mkdir -p generated experiments/results
docker compose version
docker compose build tools
if [ ! -f generated/network/genesis.json ]; then
 docker compose run --rm tools npm run init
fi
docker compose --env-file generated/config.env up -d postgres besu1 besu2 besu3 besu4
docker compose --env-file generated/config.env run --rm tools node scripts/wait-network.mjs
if [ ! -f generated/deployment.json ]; then
 docker compose --env-file generated/config.env run --rm tools npm run deploy
fi
docker compose --env-file generated/config.env up -d --build app
echo 'Open http://localhost:8080. Wallet password: generated/WALLET-PASSWORD.txt'
