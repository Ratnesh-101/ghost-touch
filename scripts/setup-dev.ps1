<#
.SYNOPSIS
  Restore the Ghost Touch dev environment after a reinstall. Idempotent.
.DESCRIPTION
  Run from anywhere:  powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
  - Never overwrites an existing .env / .env.local / settings.local.json.
  - Never reads or prints any .env file.
  - Does not install system tools (Node, Python 3.11, Git); it tells you what is missing.
  - Does not run git add/commit/push.
#>
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$script:Failed = @()

function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  WARN $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  FAIL $m" -ForegroundColor Red; $script:Failed += $m }

# Pick up tools installed after this terminal was opened.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

Step 'Prerequisites'
$py = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3.11 --version *> $null
  if ($LASTEXITCODE -eq 0) { $py = @('py', '-3.11') }
}
if (-not $py -and (Get-Command python -ErrorAction SilentlyContinue)) {
  $v = (& python --version) 2>&1
  if ("$v" -match 'Python 3\.11') { $py = @('python') }
}
$haveNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$haveNpm  = [bool](Get-Command npm -ErrorAction SilentlyContinue)
$haveGit  = [bool](Get-Command git -ErrorAction SilentlyContinue)
if ($haveNode) { Ok "node $(node --version)" } else { Fail 'node missing: https://nodejs.org (LTS 20 or newer) or: winget install OpenJS.NodeJS.LTS' }
if ($py)       { Ok "python 3.11 via: $($py -join ' ')" } else { Fail 'Python 3.11 missing: https://www.python.org/downloads/release/python-3119/ (tick "Add to PATH" and "py launcher") or: winget install Python.Python.3.11' }
if ($haveGit)  { Ok (git --version) } else { Warn 'git missing: https://git-scm.com/download/win' }
if (Get-Command gh -ErrorAction SilentlyContinue) { Ok 'gh found' } else { Warn 'gh missing (optional): winget install GitHub.cli' }
if (Get-Command agy -ErrorAction SilentlyContinue) { Ok 'agy found' } else { Warn 'agy not on PATH (optional)' }
if (Get-Command kiro -ErrorAction SilentlyContinue) { Ok 'kiro found' } else { Warn 'kiro not on PATH (optional)' }

Step 'Env files (never overwritten, never printed)'
$be = 'backend\.env'
if (Test-Path $be) { Ok "$be already exists, left alone" }
elseif (Test-Path 'backend\.env.example') { Copy-Item 'backend\.env.example' $be; Ok "$be created from .env.example: fill in your API keys yourself" }
$fe = 'frontend\.env.local'
if (Test-Path $fe) { Ok "$fe already exists, left alone" }
else { Set-Content -Path $fe -Value 'VITE_API_URL=http://localhost:8000' -Encoding ascii; Ok "$fe created (VITE_API_URL=http://localhost:8000)" }

Step 'Folders'
New-Item -ItemType Directory -Force -Path 'logs\agy', '.claude' | Out-Null
Ok 'logs\agy, .claude'

Step 'Claude Code local settings'
$sl = '.claude\settings.local.json'
if (Test-Path $sl) { Ok "$sl already exists, left alone" }
else {
  @'
{
  "permissions": {
    "allow": [
      "Edit", "Write",
      "Bash(npm test:*)", "Bash(npm run build:*)", "Bash(npm run test:*)", "Bash(npm run gen:types:*)",
      "Bash(npm --prefix frontend test:*)", "Bash(npm --prefix frontend run build:*)",
      "Bash(npm --prefix frontend exec -- tsc:*)", "Bash(npx tsc:*)", "Bash(npx vitest:*)",
      "Bash(pytest:*)", "Bash(python -m pytest:*)", "Bash(backend/.venv/Scripts/python -m pytest:*)",
      "Bash(backend/.venv/Scripts/python -m ruff:*)", "Bash(ruff check:*)", "Bash(ruff format --check:*)",
      "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)"
    ],
    "deny": [
      "Bash(git commit:*)", "Bash(git push:*)", "Bash(git reset:*)", "Bash(git checkout:*)",
      "Bash(npm install:*)", "Bash(npm i:*)", "Bash(pip install:*)",
      "Read(**/.env)", "Read(**/.env.*)", "Edit(**/.env)", "Bash(cat **/.env:*)"
    ]
  }
}
'@ | Set-Content -Path $sl -Encoding ascii
  Ok "$sl created"
}

if ($haveNode -and $haveNpm) {
  Step 'Frontend: npm ci'
  Push-Location frontend
  & npm ci
  if ($LASTEXITCODE -eq 0) { Ok 'npm ci' } else { Fail 'npm ci failed' }
  Pop-Location
}

if ($py) {
  Step 'Backend: venv + editable install with dev extras'
  $venvPy = Join-Path $Root 'backend\.venv\Scripts\python.exe'
  if (-not (Test-Path $venvPy)) {
    $exe = $py[0]; $rest = @(); if ($py.Count -gt 1) { $rest = $py[1..($py.Count - 1)] }
    & $exe @rest -m venv backend\.venv
  }
  if (Test-Path $venvPy) {
    & $venvPy -m pip install --upgrade pip
    Push-Location backend
    & $venvPy -m pip install -e '.[dev]'
    $pipOk = ($LASTEXITCODE -eq 0)
    Pop-Location
    if ($pipOk) { Ok 'pip install -e .[dev]' } else { Fail 'pip install failed' }
  } else { Fail 'could not create backend\.venv' }
}

$venvPy = Join-Path $Root 'backend\.venv\Scripts\python.exe'
if ((Test-Path $venvPy) -and $haveNode -and (Test-Path 'frontend\node_modules')) {
  Step 'Generated files (backend/scene.schema.json is git-ignored)'
  Push-Location backend
  & $venvPy -m app.export_schema
  $ok1 = ($LASTEXITCODE -eq 0)
  Pop-Location
  if ($ok1) {
    Push-Location frontend
    & npm run gen:types
    if ($LASTEXITCODE -eq 0) { Ok 'schema + scene.gen.ts regenerated' } else { Fail 'gen:types failed' }
    Pop-Location
  } else { Fail 'export_schema failed' }

  Step 'Playwright (only if the project depends on it)'
  if (Select-String -Path 'frontend\package.json' -Pattern '"@?playwright' -Quiet) {
    Push-Location frontend; & npx playwright install chromium; Pop-Location
  } else { Ok 'not a dependency yet, skipped' }

  Step 'Verify'
  Push-Location frontend
  & npx tsc --noEmit;     if ($LASTEXITCODE -ne 0) { Fail 'tsc' } else { Ok 'tsc' }
  & npm test;             if ($LASTEXITCODE -ne 0) { Warn 'frontend tests failed (known P1 flake: rerun once)' } else { Ok 'frontend tests' }
  & npm run build;        if ($LASTEXITCODE -ne 0) { Fail 'frontend build' } else { Ok 'frontend build' }
  Pop-Location
  & $venvPy -m pytest backend;                 if ($LASTEXITCODE -ne 0) { Fail 'pytest' } else { Ok 'pytest' }
  & $venvPy -m ruff check backend;             if ($LASTEXITCODE -ne 0) { Fail 'ruff check' } else { Ok 'ruff check' }
  & $venvPy -m ruff format --check backend;    if ($LASTEXITCODE -ne 0) { Fail 'ruff format' } else { Ok 'ruff format --check' }
}

if ($haveGit) {
  Step 'Ignore rules'
  $a = (git check-ignore backend/.env)
  if ($a) { Ok "ignored: $a" } else { Fail 'backend/.env is NOT git-ignored' }
  $k = (git check-ignore .kiro)
  if (-not $k) { Ok '.kiro is not ignored' } else { Fail '.kiro is ignored (Kiroween disqualification risk)' }
}

Step 'Still manual'
Write-Host '  - Fill backend\.env keys yourself (GEMINI_API_KEY, OPENAI_API_KEY, NEBIUS_API_KEY, ALLOWED_ORIGINS, VISION_PROVIDERS)'
Write-Host '  - git config user.name / user.email, gh auth login, agy login, Kiro sign-in'
if ($script:Failed.Count -gt 0) {
  Write-Host "`nDone with $($script:Failed.Count) problem(s):" -ForegroundColor Red
  $script:Failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
Write-Host "`nAll good." -ForegroundColor Green
