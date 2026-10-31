$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "File .env.local tidak ditemukan: $envFile"
}
if (-not (Select-String -Path $envFile -Pattern '^\s*CRON_SECRET\s*=\s*\S+' -Quiet)) {
  throw 'Tambahkan CRON_SECRET ke .env.local dan restart Next.js sebelum memasang jadwal.'
}

$runnerPath = Join-Path $PSScriptRoot 'run-payment-maintenance.ps1'
$taskName = 'AntreObat-Payment-Maintenance'
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runnerPath`""
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Kirim pengingat pembayaran dan batalkan pesanan delivery yang kedaluwarsa.' `
  -Force | Out-Null

Write-Output "Jadwal $taskName terpasang dan berjalan setiap menit saat Anda login."
