# Keeps the Hafize server running: if the node process dies for any reason, it starts again.
# The loop itself is PowerShell, so tools that kill every node process on the machine
# (Get-Process node | Stop-Process) cannot take the supervisor down with it.
#   powershell -NoExit -File scripts\hafize-server.ps1
$Host.UI.RawUI.WindowTitle = 'Hafize sunucusu (4173)'
Set-Location (Split-Path -Parent $PSScriptRoot)

while ($true) {
  $startedAt = Get-Date
  Write-Host "[$($startedAt.ToString('HH:mm:ss'))] Hafize baslatiliyor..."
  npm run dev:server 2>&1 | Tee-Object -FilePath hafize-server.log -Append
  $ranFor = ((Get-Date) - $startedAt).TotalSeconds
  # A quick exit means a real startup problem (for example the port is taken): wait longer.
  $pause = if ($ranFor -lt 10) { 15 } else { 2 }
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sunucu kapandi ($([int]$ranFor) sn sonra). $pause sn icinde yeniden baslatilacak."
  Start-Sleep -Seconds $pause
}
