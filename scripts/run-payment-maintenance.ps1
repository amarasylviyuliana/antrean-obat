$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "File .env.local tidak ditemukan: $envFile"
}

$secretLine = Get-Content -LiteralPath $envFile |
  Where-Object { $_ -match '^\s*CRON_SECRET\s*=' } |
  Select-Object -Last 1
if (-not $secretLine) {
  throw 'Tambahkan CRON_SECRET ke .env.local lalu restart Next.js.'
}

$secret = ($secretLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
if (-not $secret) {
  throw 'CRON_SECRET di .env.local tidak boleh kosong.'
}

$response = Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/api/cron/payments' `
  -Headers @{ Authorization = "Bearer $secret" } `
  -TimeoutSec 45

$response | ConvertTo-Json -Compress
