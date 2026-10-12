# Installe yt-dlp et lance le serveur « Durée » à chaque ouverture de session, sans fenêtre.
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $dir 'duree_serveur.py'
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command py).Source; & $py -3 -m pip install --user -U yt-dlp } else { & $py -m pip install --user -U yt-dlp }
$pyw = Join-Path (Split-Path $py) 'pythonw.exe'
if (-not (Test-Path $pyw)) { $pyw = (Get-Command pythonw).Source }
$action  = New-ScheduledTaskAction -Execute $pyw -Argument "`"$script`"" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'TrelloDureeServeur' -Action $action -Trigger $trigger -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName 'TrelloDureeServeur'
Start-Sleep 3
try { Invoke-RestMethod 'http://127.0.0.1:8765/sante' | Out-Null; Write-Host 'Serveur OK sur http://127.0.0.1:8765' }
catch { Write-Host 'Le serveur ne répond pas : voir duree_serveur.log' }
Write-Host 'Pensez à mettre à jour yt-dlp régulièrement : python -m pip install -U yt-dlp'
