$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:LOCAL_UID = '0'; $env:LOCAL_GID = '0'
New-Item -ItemType Directory -Force generated,experiments/results | Out-Null
function Run-Docker { & docker @args; if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $args" } }
Run-Docker compose version
Run-Docker compose build tools
if (!(Test-Path generated/network/genesis.json)) { Run-Docker compose run --rm tools npm run init }
Run-Docker compose --env-file generated/config.env up -d postgres besu1 besu2 besu3 besu4
Run-Docker compose --env-file generated/config.env run --rm tools node scripts/wait-network.mjs
if (!(Test-Path generated/deployment.json)) { Run-Docker compose --env-file generated/config.env run --rm tools npm run deploy }
Run-Docker compose --env-file generated/config.env up -d --build app
Write-Host 'Open http://localhost:8080. Wallet password: generated/WALLET-PASSWORD.txt'
