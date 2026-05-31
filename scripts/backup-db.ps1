$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
docker compose exec -T postgres pg_dump -U portal learning_portal | Out-File -Encoding utf8 (Join-Path $backupDir "learning_portal_$timestamp.sql")
