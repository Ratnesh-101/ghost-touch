#!/usr/bin/env bash
# Launch Antigravity's CLI (agy) headless, the safe way. Use this for EVERY agy launch.
#
#   scripts/agy-run.sh PROMPT_FILE [RUN_NAME]
#
# What it guarantees (findings in docs/research/agy-setup.md):
#   - Gemini/Google API-key variables are removed for the agy process only (your shell, Windows
#     environment and backend/.env are untouched), so an app key can never be used or burned.
#   - Model: gemini-3.8-flash-high with --effort high (override with AGY_MODEL / AGY_EFFORT).
#   - Permissions: scripts/agy-settings.json is passed with --settings. Only the exact commands
#     listed there are allowed (npm test/build, npx tsc/vitest, pytest, ruff, git status/diff/log).
#     Anything else is refused and aborts the run. The stored global grants in ~/.gemini
#     (git push, git commit, gh pr merge...) are NOT applied when this file is given.
#   - --dangerously-skip-permissions is never used. There is no way to add flags through this script.
#   - Output goes to logs/agy/<RUN_NAME>.{out.txt,err.txt,agy.log}; an auth summary is printed at the end.
set -euo pipefail

PROMPT_FILE="${1:-}"
if [[ -z "$PROMPT_FILE" || ! -f "$PROMPT_FILE" ]]; then
  echo "usage: scripts/agy-run.sh PROMPT_FILE [RUN_NAME]" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${2:-$(basename "${PROMPT_FILE%.*}")-$(date +%Y%m%d-%H%M%S)}"
MODEL="${AGY_MODEL:-gemini-3.8-flash-high}"
EFFORT="${AGY_EFFORT:-high}"
LOG_DIR="$ROOT/logs/agy"
mkdir -p "$LOG_DIR"
OUT="$LOG_DIR/$NAME.out.txt"; ERR="$LOG_DIR/$NAME.err.txt"; AGYLOG="$LOG_DIR/$NAME.agy.log"; FULL="$LOG_DIR/$NAME.prompt.txt"

# Standard rules prepended to every prompt (the allow-list is exact-match, so the agent must know the exact forms).
cat > "$FULL" <<'PREAMBLE'
RULES FOR THIS HEADLESS RUN (set by scripts/agy-run.sh):
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
PREAMBLE
cat "$PROMPT_FILE" >> "$FULL"

# Warn if the model id is not one agy reports.
if ! agy models 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
  echo "WARNING: model '$MODEL' is not in 'agy models'. Run 'agy models' and set AGY_MODEL." >&2
fi

echo "agy-run: model=$MODEL effort=$EFFORT settings=scripts/agy-settings.json name=$NAME"
set +e
env -u GEMINI_API_KEY -u GOOGLE_API_KEY -u GOOGLE_GENAI_API_KEY -u GOOGLE_APPLICATION_CREDENTIALS -u GOOGLE_CLOUD_PROJECT \
  agy --print "$(cat "$FULL")" \
      --model "$MODEL" --effort "$EFFORT" \
      --mode accept-edits \
      --settings "$ROOT/scripts/agy-settings.json" \
      --output-format text \
      --log-file "$AGYLOG" \
  > "$OUT" 2> "$ERR"
STATUS=$?
set -e

# Auth summary from agy's own log (no secrets are printed).
echo "--- agy exit status: $STATUS"
if grep -q "authenticated via keyring" "$AGYLOG" 2>/dev/null; then
  echo "--- auth: OK, signed-in Antigravity account (OS keyring OAuth), not an API key"
else
  echo "--- auth: WARNING, no 'authenticated via keyring' line in $AGYLOG" >&2
fi
echo "--- endpoint host(s): $(grep -oE 'https?://[A-Za-z0-9.-]+' "$AGYLOG" 2>/dev/null | sort -u | tr '\n' ' ')"
echo "--- model label: $(grep -oE 'selected model override to backend: label="[^"]*"' "$AGYLOG" 2>/dev/null | head -1 | sed 's/.*label=//')"
echo "--- outputs: $OUT (agent text) | $ERR | $AGYLOG"
exit "$STATUS"
