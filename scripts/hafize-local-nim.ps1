[CmdletBinding()]
param(
  [ValidateSet('Check','Deploy','Verify')][string]$Action='Check',
  [ValidatePattern('^nvcr\.io/nim/[a-z0-9._/-]+:[a-zA-Z0-9._-]+$')][string]$Image='nvcr.io/nim/meta/llama-3.1-8b-instruct:2.1.6',
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$')][string]$Model='meta/llama-3.1-8b-instruct',
  [ValidateRange(1024,65535)][int]$Port=8000,
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,60}$')][string]$Name='hafize-nim-chat',
  [ValidateRange(30,7200)][int]$WaitSeconds=1800,
  [switch]$StartHafize
)
$ErrorActionPreference='Stop'
function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE)." }
}
function Test-GpuHost {
  if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) { throw 'nvidia-smi missing; install supported NVIDIA driver.' }
  & nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv
  if ($LASTEXITCODE -ne 0) { throw 'NVIDIA driver/GPU detection failed.' }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker missing; install and start Linux-container Docker with GPU support.' }
  $os = & docker info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0 -or $os -ne 'linux') { throw 'Linux Docker engine unavailable (Windows: WSL2 backend).' }
  Write-Host 'GPU and Linux Docker detected. Model-specific VRAM/profile compatibility still needs real deployment.'
}
function Test-Nim {
  $base="http://127.0.0.1:$Port/v1"
  $ready=Invoke-RestMethod "$base/health/ready" -TimeoutSec 10
  if ($ready.status -ne 'ready') { throw 'NIM not ready.' }
  $models=@((Invoke-RestMethod "$base/models" -TimeoutSec 10).data | ForEach-Object { $_.id })
  if ($models -notcontains $Model) { throw "Requested model not in served model list: $Model" }
  $body=@{model=$Model;messages=@(@{role='user';content='Reply briefly: Merhaba.'});stream=$false;max_tokens=32} | ConvertTo-Json -Depth 5
  $answer=Invoke-RestMethod "$base/chat/completions" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 120
  if (-not $answer.choices -or [string]::IsNullOrWhiteSpace($answer.choices[0].message.content)) { throw 'NIM inference returned no assistant content.' }
  Write-Host "PASS: readiness, model discovery and real text inference: $Model"
  $env:HAFIZE_LOCAL_MODEL_ENABLED='true'
  $env:HAFIZE_LOCAL_MODEL_PROTOCOL='nim'
  $env:HAFIZE_LOCAL_MODEL_BASE_URL=$base
  Write-Host "Local provider configured for this script process: $base"
}
if ($Action -eq 'Check') { Test-GpuHost; return }
if ($Action -eq 'Deploy') {
  Test-GpuHost
  $existing = @(& docker ps -a --filter "name=^/$Name$" --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0) { throw 'Container list failed.' }
  if ($existing -contains $Name) {
    $configuredImage = & docker inspect --format '{{.Config.Image}}' $Name
    if ($LASTEXITCODE -ne 0 -or $configuredImage -ne $Image) { throw 'Container exists with different image; choose another name. Nothing removed.' }
    Invoke-Docker @('start',$Name)
  } else {
    Invoke-Docker @('pull',$Image)
    $argsList=@('run','-d','--name',$Name,'--gpus','all','--restart','unless-stopped','--shm-size','16g','-p',"127.0.0.1:${Port}:8000",'-v','hafize-nim-cache:/opt/nim/.cache','-e',"NIM_SERVED_MODEL_NAME=$Model")
    if ($env:NGC_API_KEY) { $argsList+=@('-e','NGC_API_KEY') }
    if ($env:HF_TOKEN) { $argsList+=@('-e','HF_TOKEN') }
    if ($env:NIM_MODEL_PROFILE) { $argsList+=@('-e','NIM_MODEL_PROFILE') }
    $argsList+=$Image
    Invoke-Docker $argsList
  }
  $deadline=(Get-Date).AddSeconds($WaitSeconds)
  $isReady=$false
  do {
    try {
      $probe=Invoke-RestMethod "http://127.0.0.1:$Port/v1/health/ready" -TimeoutSec 5
      if ($probe.status -eq 'ready') { $isReady=$true; break }
    } catch {}
    $running=& docker inspect --format '{{.State.Running}}' $Name
    if ($LASTEXITCODE -ne 0 -or $running -ne 'true') { throw "NIM stopped. Inspect locally: docker logs $Name" }
    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)
  if (-not $isReady) { throw "NIM readiness timeout. Inspect locally: docker logs $Name" }
}
Test-Nim
if ($StartHafize) {
  Push-Location (Join-Path $PSScriptRoot '..')
  try { & npm start; if ($LASTEXITCODE -ne 0) { throw 'Hafize startup failed.' } }
  finally { Pop-Location }
} else {
  Write-Host 'For Hafize startup with these settings, rerun with -Action Verify -StartHafize.'
}
