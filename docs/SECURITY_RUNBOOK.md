# Ghost Touch — Security Runbook

Plain-language operational procedures for the repository owner and maintainers.

---

## 1. Emergency Kill Switch (Stop All Paid AI Calls)

If you need to instantly stop all external AI API spending without taking the application offline:

1. Open the [Render Dashboard](https://dashboard.render.com) and navigate to the `ghost-touch-backend` service.
2. Go to the **Environment** tab.
3. Change `PAID_CALLS_PER_DAY` to `0` (or add it if not explicitly defined) and click **Save Changes**.
4. Render will trigger an immediate rolling restart of the backend container.

### How it behaves
Setting `PAID_CALLS_PER_DAY=0` causes `backend/app/paid_budget.py` to treat the daily budget as immediately exhausted (`is_budget_exhausted() == True`). The server stops forwarding images or queries to Gemini, OpenAI, and Nebius. The application automatically and gracefully falls back to local OpenCV Raw Mode edge detection (`backend/app/raw_mode.py`) for scene outlines and deterministic facts lookup (`facts_lookup`) for diagram Q&A. Students and teachers can continue exploring diagrams tactilely with zero external API calls or costs.

To restore paid AI processing, change `PAID_CALLS_PER_DAY` back to your desired allowance (default is `2000`) and save.

---

## 2. API Key Rotation Procedures

When rotating API credentials, always follow this zero-downtime sequence:
1. Generate the new key in the provider's developer console.
2. Update the environment variable on the Render dashboard.
3. Trigger a manual deploy (or wait for automatic redeployment) and verify health.
4. Delete or revoke the old key at the provider console.

Never log, print, or commit key values to Git.

### Google Gemini Key Rotation
Log in to [Google AI Studio](https://aistudio.google.com/) or the Google Cloud Console for your project. Under **Get API Key**, create a new API key scoped to your Ghost Touch application. In the Render service dashboard for `ghost-touch-backend`, open the **Environment** tab and update `GEMINI_API_KEY` with the newly generated value. Trigger a manual redeploy from Render and check that `GET /api/v1/health` returns `{"ok":true}`. After confirming that the backend starts cleanly and processes a test diagram, return to Google AI Studio and permanently delete the retired API key.

### OpenAI Key Rotation
Log in to the [OpenAI Platform Dashboard](https://platform.openai.com/api-keys) under your project account. Generate a new secret key with permissions appropriate for model completions. In the Render service dashboard for `ghost-touch-backend`, update the `OPENAI_API_KEY` environment variable with the new secret key. Trigger a redeployment on Render and inspect the startup logs to ensure initialization succeeded. After confirming successful inference, revoke and delete the old secret key from your OpenAI dashboard.

### Nebius Token Factory Key Rotation
Log in to the [Nebius AI Studio Console](https://tokenfactory.nebius.com/) and navigate to your Project Settings and API Keys section. Generate a new service API token. In Render's dashboard for `ghost-touch-backend`, open the **Environment** tab and update `NEBIUS_API_KEY` with the newly generated token. Trigger a deployment on Render and verify that the backend initializes and completes health checks. Once verified, delete the old API token from the Nebius console.

---

## 3. What Resets on Process Restart

The backend runs as a stateless container on Render (restarting on new deploys, configuration updates, container crashes, or waking from sleep on Render's free tier). The following state is stored in Python process RAM and **resets completely on every restart**:

- **Daily Paid Call Budget (`backend/app/paid_budget.py`):** The in-memory daily count resets to zero. Every process restart starts the daily count fresh in RAM. *Operational note:* Because container restarts clear this ledger, software budget checks cannot serve as an absolute financial ceiling. The owner must establish hard spending caps directly on provider billing consoles.
- **Rate-Limiting Memory (`backend/app/limits.py`):** The sliding-window request timestamps (`_HITS` table, 60-second window) and in-flight concurrency tracking tables are cleared.
- **In-Memory Scene Cache (`backend/app/scene_cache.py`):** The 64-entry diagram geometry JSON cache (6-hour TTL) is emptied.
- **Client IP Ledger:** Per-client daily call counts in `paid_budget.py` reset to empty.

---

## 4. Per-Client Budget and Classroom Tuning

The environment variable `PAID_CALLS_PER_CLIENT_PER_DAY` in `backend/app/paid_budget.py` controls the maximum number of paid AI calls an individual client network address (IP) may consume during a single UTC day.

- **Why it exists:** Without a per-client limit, a single misbehaving client, automated loop, or abusive user could consume the entire global quota (`PAID_CALLS_PER_DAY=2000`) within minutes, forcing every other student into Raw Mode for the rest of the day. When a client exceeds their daily allowance, only that specific client receives Raw Mode edge outlines and deterministic facts Q&A with reason `budget_exhausted`; all other users continue receiving full AI vision service.

### Tuning for a Classroom Behind One IP
In school and workshop deployments, an entire classroom of 25–30 blind and low-vision students typically accesses the web through a single public IP address via school Wi-Fi NAT.
- **Standard single-user default (`500`):** Provides solid abuse protection for general web traffic. However, 30 students each capturing diagrams and asking questions (averaging ~35 paid calls each) will generate ~1,050 calls in a school day and hit the default 500 limit mid-afternoon.
- **Classroom setting (`1000` to `1200`):** Recommended on Render when hosting a dedicated classroom session or teacher training workshop.
- **Uncapped per-client (`0` or unset):** Disables per-client throttling while still enforcing the global daily budget cap.

---

## 5. After-Deploy Smoke Command

After any deployment to Vercel or Render, run the automated smoke verification script from your local machine:

```bash
node scripts/smoke-deployed.mjs https://ghost-touch.vercel.app https://ghost-touch-api.onrender.com
```
*(Replace the URLs above with your production Vercel frontend and Render backend endpoints).*

### What the command checks
The script runs without external dependencies (Node 22 built-in fetch) and prints a PASS/FAIL verdict for each check (exiting 0 on full success, 1 on any failure):
1. **Frontend Headers:** Root URL returns HTTP 200 with required Content-Security-Policy (CSP), HSTS, nosniff, Referrer-Policy, and Permissions-Policy headers.
2. **CSP Host Match:** Frontend CSP `connect-src` directive explicitly contains the origin of the deployed API endpoint.
3. **Backend Health & Cold Start:** `GET /api/v1/health` responds with `{"ok":true}` within 70 seconds (accommodating cold-start container wake-ups) and carries `x-content-type-options: nosniff`.
4. **CORS Restrictions:** An `OPTIONS /api/v1/ask` preflight request carrying the frontend origin is accepted, while an untrusted origin (`https://example.invalid`) is rejected.
5. **Interactive Docs Off:** `GET /docs` returns HTTP 404 (Swagger/OpenAPI documentation is disabled in production).
6. **Input Type Enforcement:** `POST /api/v1/scene` with a plain text file is rejected with HTTP 415 Unsupported Media Type.
7. **Bundled Asset Verification:** Frontend static sample `/samples/triangle.json` parses as valid JSON with `kind: "geometry"`.
8. **PWA Service Worker:** `GET /sw.js` returns HTTP 200 with cache-prevention headers (`no-cache`).
9. **Status & AI Availability:** `GET /api/v1/status` returns HTTP 200 and confirms `ai_available: true`.

The smoke test transmits zero camera images, zero personal data, and zero API credentials.

---

## 6. Automated Agent Guardrails

When operating autonomous or headless AI coding agents (such as Antigravity `agy`, Kiro, or Claude Code) in this repository:

1. **Dangerous Mode Restrictions:** Running an agent with skipped permission checks (`--dangerously-skip-permissions` or `AGY_DANGEROUS=1`) is strictly prohibited in any checkout containing a `.env` file with live API keys. Dangerous mode may only run in an isolated git worktree where no environment files exist.
2. **Never Process Untrusted Input:** Never run agents with shell execution permissions against untrusted input, including unvetted pull requests, untrusted third-party documentation, unknown external URLs, or malicious image attachments that could contain prompt injections.
3. **Tool Separation:** Never grant an agent toolset network-access tools (curl, web browsing, HTTP fetch) simultaneously with unrestricted shell execution tools.
4. **Orchestrator Gates:** Every automated agent diff must be reviewed and tested by the orchestrator (verifying TypeScript compilation via `tsc --noEmit`, test suites passing, and code formatting) before merging into `main`.
5. **Secret Scanning on Push:** Run automated secret detection (`gitleaks detect` or GitHub push protection) before every git push to guarantee no keys, dotfiles, or secrets are tracked in history.
6. **Compromise Response:** If an agent run behaves unexpectedly, attempts unauthorized network or shell commands, or accesses sensitive configuration paths, immediately rotate all three provider API keys (Gemini, OpenAI, Nebius) following Section 2 above.

---

## 7. Symptom & Troubleshooting Table

| Symptom | Cause | Remedy |
|---|---|---|
| **Busy for a whole class** | A whole class behind one NAT IP exceeds per-client in-flight limits (`SCENE_CLIENT_MAX_CONCURRENCY`, `ASK_CLIENT_MAX_CONCURRENCY`), per-minute rate limits, or queue wait times when multiple students scan diagrams simultaneously. | In Render Environment tab, raise `SCENE_CLIENT_MAX_CONCURRENCY` and `ASK_CLIENT_MAX_CONCURRENCY` (e.g. from `2` to `4`–`8`), increase `RATE_LIMIT_SCENE_PER_MIN` / `RATE_LIMIT_ASK_PER_MIN`, or increase `SCENE_QUEUE_WAIT_SECONDS` (e.g. to `10.0`–`15.0`). In class, stagger student diagram captures by a few seconds. |
| **Outlines only for everyone** | Global daily budget exhausted (`PAID_CALLS_PER_DAY` reached), emergency kill switch active (`PAID_CALLS_PER_DAY=0`), or all provider API keys missing, invalid, or expired. | Check `GET /api/v1/status` (`ai_available` will be `false`). Verify `PAID_CALLS_PER_DAY` is not set to `0` in Render dashboard. Check provider billing consoles (Gemini, OpenAI, Nebius) and rotate keys following Section 2 if expired or revoked. |
