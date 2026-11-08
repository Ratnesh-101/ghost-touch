# Secrets and supply-chain audit (Claude Sonnet subagent, read-only, 2026-11-08)
Scope: 482 commits across all local and remote branches. No `.env*` file was opened. Pattern coverage is the limit of "clean"; no entropy scan, no `npm audit` or `pip-audit` (offline).

**Verdict: history is clean of real secrets.** Only hit: a dummy `AIza...` string quoted in `docs/reports/audit-a6-security-fullstack.md`. Only `.env.example` files were ever committed. No `.pem`/`.key`/`logs/` ever committed.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S-01 | Med | `frontend/vercel.json` CSP `connect-src` allows only `https://ghost-touch-api.onrender.com`, but `render.yaml:5` names the service `ghost-touch-backend` (docs/DEPLOY.md uses `ghost-touch-backend-xxxx`). A fresh Blueprint deploy gets a different host and the CSP blocks it. **Checked by supervisor: README says the live API is ghost-touch-api.onrender.com, so render.yaml drifted.** | Rename the service in `render.yaml` to `ghost-touch-api`, or make the CSP host configurable. |
| S-02 | Med | No privacy statement anywhere, yet photos go to third-party vision APIs (OpenAI, Gemini, Nebius). Users are blind students, some minors. Scene cache (`backend/app/scene_cache.py`, 64 entries, 6 h TTL): not checked whether it keeps the image. | Add `docs/PRIVACY.md` and a one-line in-app notice; confirm no log prints provider error bodies. |
| S-03 | Low/Med | `pull_request_target` in `labeler.yml` with write token. Safe today (no PR checkout). | Never add a checkout of the PR head there. |
| S-04 | Low | Third-party actions pinned by tag, not SHA (gitleaks, release-drafter has `contents: write`, codeql). | Pin to SHAs. |
| S-05 | Low | `pbt-soak.yml` lines 47, 80 interpolate `workflow_dispatch` inputs into shell. | Pass through `env:` and validate as integer. |
| S-06 | Low | Local `C:\Users\Admin\...` paths and the owner/repo name in public docs; a named third party (Blind People's Association) in `docs/handoff.md`. | Optional scrub. |
| S-07 | Low | `requirements.lock` has no hashes; uvicorn extras (watchfiles, websockets, httptools) not needed on Render. | Optional. |
| S-08 | Low | Frontend deps are caret ranges; versions could not be checked offline. No install scripts inspected. | Run `npm audit`, `pip-audit`. |
| S-09 | Info | `.gitignore` covers `.env*`, `logs/`, `.venv`, `node_modules`. `graphify-out/` tracked status not checked. | |

Good: Vercel headers (CSP without script `unsafe-inline`, HSTS, X-Frame-Options DENY), least-privilege workflow permissions, gitleaks with full history in CI, `render.yaml` secrets are `sync: false`.
