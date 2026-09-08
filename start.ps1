$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'frontend\dist\index.html')) {
    throw 'Frontend build is missing. Run .\setup.ps1 first.'
}
$mentorPython = if (Test-Path -LiteralPath '.venv\Scripts\python.exe') { '.\.venv\Scripts\python.exe' } else { 'python' }
Write-Host 'zentutor.ai: http://127.0.0.1:8000 (Ctrl+C to stop)'
& $mentorPython -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
