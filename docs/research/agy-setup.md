# Running agy (Antigravity CLI) headless, safely

Investigated and tested on 2026-11-01 by Claude Code. No key value was printed at any point: variables are reported only as SET or NOT SET, logs were redacted before reading.

## The question
Does headless `agy` authenticate with the app's `GEMINI_API_KEY` (burning the app's Gemini quota) instead of the signed-in Antigravity account?

## Findings (what is evidence, not assumption)
1. **No key variable is set anywhere agy could inherit it.** `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT` are all **NOT SET** in the Claude Code shell, in the Windows **User** environment and in the Windows **Machine** environment.
2. **Nothing in the repo exports or loads the key into a shell.** The only code that reads `backend/.env` is the research script (`research/vision_spike.py`), which loads it into **its own Python process** only, and uvicorn's `--env-file` for the backend. The repo-root `.env` is **0 bytes**, so an auto-load from the working directory could not supply a key either. (The key lives in `backend/.env`, which is not in agy's working directory.)
3. **agy authenticates with the signed-in account, not a key.** agy's own log, for runs with the key variables removed and also for the earlier unmodified runs, says: `ChainedAuth: authenticated via keyring (effective: keyring)`, `OAuth: authenticated successfully … authMethod=consumer`, `Print mode: silent auth succeeded`.
4. **Its requests go to Antigravity's backend, not the Gemini API.** The only host contacted is `daily-cloudcode-pa.googleapis.com` (Cloud Code). A Gemini API key would use `generativelanguage.googleapis.com`.
5. **The 429 errors came from my own scripts**, not from agy: the spike and the probes called the Gemini API directly with the key from `backend/.env` (limit: 20 requests per day per model on the free tier; see `docs/research/vision-spike.md`). Antigravity's quota screen stays at 100% for the Gemini group because that screen counts Antigravity use, not API-key use.
6. The log also contains `You are not logged into Antigravity` / `Auth mode is unspecified` lines. They come from side services (experiments, model list refresh) that fail to get a token in a headless process; the main generation path still authenticates through the keyring and works. If you ever see runs fail with an auth error, sign in once in the Antigravity app or interactive `agy`; there is no `agy login` subcommand.

So the suspected cause (agy using `GEMINI_API_KEY`) is **not supported by the evidence**. The launcher below still removes those variables for the agy process, so it cannot happen in the future either.

## What agy offers (from `agy --help`, `agy models`, and tests)
- Model: `--model <id>`. `agy models` reports exactly: `gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`. "Gemini 3.8 Flash, high effort" is **`gemini-3.8-flash-high`**; agy's own log confirms the label "Gemini 3.8 Flash (High)". (There is no `gemini-3.7-flash-*` in agy: trying `gemini-3.7-flash-high` returned "not recognized as a known model" and listed the available ones. You said 3.8 was what you meant.)
- Effort: `--effort low|medium|high|xhigh|max`. It is accepted together with `gemini-3.8-flash-high` (tested). (The refusal I saw with `--effort` on `gemini-3.7-flash-high` was only because that model id does not exist.)
- Auth mode: no flag and no status command; the log (`--log-file`) is the only place that says how it authenticated.
- Permissions: `--settings` takes a JSON file or string (session only, never saved). Headless mode **soft-denies** any command that is not allowed and **ends the whole run**; it cannot prompt.

## How permissions really work (tested, with harmless commands)
- Rules look like `command(<exact text>)`. Matching is **exact on the full command text**: `command(git status)` ran `git status` but refused `git status --short`. Wildcards (`*`, `:*`, `status*`) did **not** work.
- agy's command tool has **no working-directory option**, and `cd x && y` would not match an allow rule. So allowed commands must work from the repo root (`npm --prefix frontend test`, `backend/.venv/Scripts/python -m pytest backend`, ...).
- **Deny rules work** and are reported as "Matches user-configured deny rule". Anything not allowed is refused anyway.
- **Your stored global grants are not applied when `--settings` supplies permissions.** `~/.gemini/config/config.json` holds `git push`, `git commit`, `git add`, `gh pr create`, `gh pr view`, `gh pr merge`, `git log`, `git status` and `git -C`. With a session settings file, even a bare `git add` was refused. Without one, headless agy would be allowed to run `git push` and `gh pr merge`. (Not changed: those grants are yours, and the Antigravity app uses them. You may want to remove push, commit and merge from them yourself.)
- A **git remote called `origin` exists** in this repository. No test ever ran a command that could push.

## The fix: use the launcher for every agy run
- `scripts/agy-run.sh PROMPT_FILE [RUN_NAME]` (Git Bash) or `powershell -NoProfile -File scripts\agy-run.ps1 -PromptFile PROMPT_FILE [-Name RUN_NAME]`.
- It removes the five key variables **for the agy process only** (your shell, Windows variables and `backend/.env` are untouched), runs `--model gemini-3.8-flash-high --effort high --mode accept-edits --settings scripts/agy-settings.json`, never passes `--dangerously-skip-permissions` (and has no way to add flags), prepends a standard rules block to the prompt, and writes `logs/agy/<name>.{out.txt,err.txt,agy.log,prompt.txt}` (`logs/` is gitignored).
- After each run it prints an auth summary read from the log: auth method, endpoint host, model label.
- `scripts/agy-settings.json` is the single allow/deny list. Allowed (exact text): `npm --prefix frontend test`, `npm --prefix frontend run build`, `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `backend/.venv/Scripts/python -m pytest backend`, `... -m ruff check backend`, `... -m ruff format --check backend`, `git status`, `git status --short`, `git diff`, `git diff --stat`, `git log`, `git log --oneline` (also `-5`, `-10`). Denied explicitly: `git add/commit/push/reset/checkout/restore/stash/rebase/clean/branch/tag`, `gh`, `rm`, `del`, `Remove-Item`, `npm install/i/ci`, `pip install`, `curl`, `Invoke-WebRequest`. To allow another command, add its exact text.
- **Limits:** the allow-list controls shell commands only. Agents can still edit files in the workspace (that is the point of `accept-edits`) and read files with the file-viewing tool, so "do not read env files" is enforced by the prompt rules, not by a permission. Review diffs after every run, as before.

## Verification (2026-11-01, all with the key variables removed and no dangerous flag)
| Check | Result |
|---|---|
| Tiny task through the script: create `docs/handoffs/agy-auth-test.md` with the model name | File exists; it says `Model: Gemini 3.8 Flash (High) (gemini-3.8-flash-high)` and `Effort: high` |
| Auth in the log | `authenticated via keyring`, `authMethod=consumer`; host `daily-cloudcode-pa.googleapis.com` only |
| Model in the log | label "Gemini 3.8 Flash (High)" |
| Allowed commands through the script | `npm --prefix frontend exec -- tsc -p frontend --noEmit`, `... ruff check backend` and `git status --short` all ran (exit 0) |
| Refusals | `git status --short` refused when only `git status` was allowed; `git commit --dry-run` and a bare `git add` refused; deny rule message seen for `git add` |
| `HEAD` | unchanged (`9454a4d`) through every test; nothing staged |
| PowerShell script | dry run prints the plan and the removed variable names; real run not repeated |

## Honest notes
- The three fix/build agents launched earlier today (T09, T10a, F1, F2, the commit agents and my own aborted `agy` spike) used `--dangerously-skip-permissions`, with your approval at the time. No further launch will. F1 and F2 had already finished when this rule arrived.
- The offline vision spike through agy (`research/vision_spike.py --provider agy`) originally used `--dangerously-skip-permissions`; it was stopped, and on Nov 2 it was changed to use `scripts/agy-settings.json` and to remove the key variables for the child process, with no dangerous flag. It has not been re-run.
- On Nov 2 the owner explicitly re-approved `--dangerously-skip-permissions` for one job (committing the pending work). That run was limited by the prompt to the listed `git add` / `git commit` commands and checked afterwards (history, files per commit, no push).
