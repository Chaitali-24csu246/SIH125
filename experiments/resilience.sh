#!/bin/sh
set -eu
# Run from project root. Always restore the stopped validator, including on failure.
trap 'docker compose --env-file generated/config.env start besu4' EXIT INT TERM
docker compose --env-file generated/config.env stop besu4
docker compose --env-file generated/config.env run --rm tools node experiments/resilience.mjs
