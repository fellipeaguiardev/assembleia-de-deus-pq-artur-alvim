# ============================================================
# Instala o programa da pregação neste computador (uma vez só).
#   powershell -ExecutionPolicy Bypass -File scripts\pregacao\instalar.ps1
# - confere Node, Python e ffmpeg (instala o yt-dlp pelo pip)
# - cria a chave, se ainda não existir (aí mostra o SQL para rodar no Supabase)
# - cria a tarefa "Pregacao no podcast" no Agendador de Tarefas: roda de hora em
#   hora, sem abrir janela, enquanto você estiver com o Windows aberto.
# Para desinstalar: Unregister-ScheduledTask -TaskName "Pregacao no podcast"
# ============================================================
$ErrorActionPreference = "Stop"
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Instale o Node.js (https://nodejs.org) e rode de novo." }
Write-Host "Node: $node"

$py = (Get-Command py -ErrorAction SilentlyContinue).Source
if (-not $py) { throw "Instale o Python (winget install Python.Python.3.13) e rode de novo." }
Write-Host "Instalando/atualizando o yt-dlp..."
& py -m pip install --user -U --quiet --disable-pip-version-check "yt-dlp[default]"
& py -m yt_dlp --version

$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffLocal = Get-ChildItem "$env:USERPROFILE\ffmpeg\*\bin\ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $ff -and -not $ffLocal -and -not (Test-Path "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ffmpeg.exe")) {
  Write-Host "Instalando o ffmpeg..."
  winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
}

& $node "$pasta\nova-chave.mjs"

$acao = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$pasta\rodar-escondido.vbs`" `"$node`""
$quando = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1)
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName "Pregacao no podcast" -Action $acao -Trigger $quando -Settings $config -Description "Publica o audio da pregacao das lives no podcast do site (scripts/pregacao/rodar.mjs)" -Force | Out-Null
Write-Host ""
Write-Host "Pronto: a tarefa 'Pregacao no podcast' roda de hora em hora."
Write-Host "Registro: $env:USERPROFILE\.pregacao-podcast\registro.log"
