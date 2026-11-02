<#
.SYNOPSIS
  Launch Antigravity's CLI (agy) headless, the safe way. Use this for EVERY agy launch.

.DESCRIPTION
  scripts\agy-run.ps1 -PromptFile prompt.txt [-Name run1]
  Same guarantees as scripts/agy-run.sh (see docs/research/agy-setup.md):
  API-key variables removed for this process only (restored afterwards), model gemini-3.8-flash-high with
  --effort high, permissions from scripts/agy-settings.json (exact-match allow-list, stored global grants not
  applied), --dangerously-skip-permissions never used, output in logs\agy\.
  Run it with:  powershell -NoProfile -File scripts\agy-run.ps1 -PromptFile <file>
  (-File runs it in its own process, so even the temporary variable removal cannot touch your session.)
#>
param(
  [Parameter(Mandatory = $true)][string]$PromptFile,
  [string]$Name = '',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $PromptFile -PathType Leaf)) { Write-Error "Prompt file not found: $PromptFile"; exit 2 }
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Name) { $Name = '{0}-{1}' -f [IO.Path]::GetFileNameWithoutExtension($PromptFile), (Get-Date -Format 'yyyyMMdd-HHmmss') }
$Model = if ($env:AGY_MODEL) { $env:AGY_MODEL } else { 'gemini-3.8-flash-high' }
$Effort = if ($env:AGY_EFFORT) { $env:AGY_EFFORT } else { 'high' }
$LogDir = Join-Path $Root 'logs\agy'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Out = Join-Path $LogDir "$Name.out.txt"; $Err = Join-Path $LogDir "$Name.err.txt"
$AgyLog = Join-Path $LogDir "$Name.agy.log"; $Full = Join-Path $LogDir "$Name.prompt.txt"

$preamble = @'
RULES FOR THIS HEADLESS RUN (set by scripts/agy-run.ps1):
- You may run ONLY these shell commands, typed exactly as written, one per call, from the repo root. Do not use
  cd, &&, ; or pipes (the command tool has no working-directory option, and permissions match the exact text):
  npm --prefix frontend test
  npm --prefix frontend run build
  npm --prefix frontend exec -- tsc -p frontend --noEmit
  backend/.venv/Scripts/python -m pytest backend
  backend/.venv/Scripts/python -m ruff check backend
  backend/.venv/Scripts/python -m ruff format --check backend
  git status | git status --short | git diff | git diff --stat | git log --oneline -5 | git log --oneline -10
- Any other command is refused and ends the whole run. Never run git add, commit, push, reset, checkout, rm, installs or network tools.
- Never open, print or search any environment-variable file (a dot-file whose name contains env). Never print any key.
- Edit only the files your task names.

TASK:
'@
Set-Content -LiteralPath $Full -Value ($preamble + [Environment]::NewLine + (Get-Content -LiteralPath $PromptFile -Raw)) -Encoding UTF8

$prevEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$modelList = (& agy models 2>&1 | ForEach-Object { "$_" })
$ErrorActionPreference = $prevEap
if (-not ($modelList -match ("^" + [regex]::Escape($Model) + "\s"))) {
  Write-Warning "Model '$Model' is not in 'agy models'. Run 'agy models' and set AGY_MODEL."
}
Write-Output "agy-run: model=$Model effort=$Effort settings=scripts\agy-settings.json name=$Name"

$vars = 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT'
$saved = @{}
foreach ($v in $vars) { $saved[$v] = [Environment]::GetEnvironmentVariable($v, 'Process'); [Environment]::SetEnvironmentVariable($v, $null, 'Process') }
$status = 0
try {
  $args = @('--print', (Get-Content -LiteralPath $Full -Raw), '--model', $Model, '--effort', $Effort,
            '--mode', 'accept-edits', '--settings', (Join-Path $Root 'scripts\agy-settings.json'),
            '--output-format', 'text', '--log-file', $AgyLog)
  if ($DryRun) {
    Write-Output "DRY RUN: would run: agy --print <$((Get-Item $Full).Length) byte prompt> --model $Model --effort $Effort --mode accept-edits --settings scripts\agy-settings.json --output-format text --log-file $AgyLog"
    Write-Output "DRY RUN: key variables removed for the child process: $($vars -join ', ')"
  } else {
    & agy @args 1> $Out 2> $Err
    $status = $LASTEXITCODE
  }
} finally {
  foreach ($v in $vars) { [Environment]::SetEnvironmentVariable($v, $saved[$v], 'Process') }
}

Write-Output "--- agy exit status: $status"
if ((Test-Path $AgyLog) -and (Select-String -Path $AgyLog -Pattern 'authenticated via keyring' -Quiet)) {
  Write-Output '--- auth: OK, signed-in Antigravity account (OS keyring OAuth), not an API key'
} elseif (-not $DryRun) {
  Write-Warning "auth: no 'authenticated via keyring' line in $AgyLog"
}
if (Test-Path $AgyLog) {
  $hosts = Select-String -Path $AgyLog -Pattern 'https?://[A-Za-z0-9.-]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique
  Write-Output "--- endpoint host(s): $($hosts -join ' ')"
}
Write-Output "--- outputs: $Out | $Err | $AgyLog"
exit $status
