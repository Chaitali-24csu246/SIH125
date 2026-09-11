#!/bin/sh
set -eu
cp /config/static-nodes.json /var/lib/besu/static-nodes.json
cp /config/permissions_config.toml /var/lib/besu/permissions_config.toml
exec /opt/besu/bin/besu \
 --data-path=/var/lib/besu \
 --genesis-file=/config/genesis.json \
 --node-private-key-file=/config/node${NODE_NUMBER}/key \
 --p2p-host=172.28.26.$((10 + NODE_NUMBER)) \
 --discovery-enabled=false \
 --permissions-nodes-config-file-enabled=true \
 --rpc-http-enabled=true --rpc-http-host=0.0.0.0 \
 --rpc-http-api=ETH,NET,WEB3 \
 --host-allowlist=localhost,127.0.0.1,besu1,besu2,besu3,besu4 \
 --rpc-http-cors-origins=http://localhost:8080 \
 --min-gas-price=0 --sync-mode=FULL
