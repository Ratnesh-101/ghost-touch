# Ghost Touch — Owner Final Checklist

> **Purpose:** Single-page operational punch list for the repository owner to execute end-to-end verification, phone testing, translation review, and submission.  
> **Status:** All items require owner action; no hardware verification is claimed in advance.

---

### (A) Before the Phone Test
- [ ] **Vercel Feature Flags:** Verify `VITE_FEATURE_GUIDE=1` and `VITE_FEATURE_SHARE=1` are set in Vercel project environment variables (Production & Preview).
- [ ] **Render Environment Check:** Confirm vision provider keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are active on the Render dashboard.
- [ ] **Redeploy & Confirm Build:** Trigger a fresh Vercel deployment of `main` to serve the current build (creature theme, Guide, and Teacher Share).
- [ ] **Backend Health Check:** Open `https://ghost-touch-api.onrender.com/api/v1/health` in Chrome; wait for HTTP 200 `{"ok":true}` to warm the container (~32–35 s cold start).
- [ ] **One Real Photo AI Mode:** Capture one test diagram photo; verify the backend returns `mode: "ai"` (no raw mode fallback banner or timeout).

---

### (B) Phone Test (OnePlus Nord CE6)
*Full procedures and pass/fail criteria are in [docs/PHONE_TEST.md](./PHONE_TEST.md).*

- [ ] **[Step 0–3](./PHONE_TEST.md#step-0-wake-the-render-backend-pre-test-0-min-on-stopwatch): Environment & PWA Baseline** `[PASS / FAIL]`  
  Wake Render, install PWA to home screen, single-tap audio unlock, verify Settings persistence (language, rate, feature toggles).
- [ ] **[Step 4](./PHONE_TEST.md#step-4-explore-samples-with-talkback-off-3-min): Direct Touch Exploration (TalkBack OFF)** `[PASS / FAIL]`  
  Continuous line buzz (`80 ms` / `70 ms`), corner double-pulse (`[50, 90, 50] ms`), 450 ms quiet window, sine theremin pitch glide.
- [ ] **[Step 5](./PHONE_TEST.md#step-5-explore-samples-with-talkback-on-3-min): TalkBack Pass-Through Exploration** `[PASS / FAIL]`  
  TalkBack focus speaks Explore diagram name first; double-tap-and-hold then drag delivers 25 ms centre tick and tracks relative touches cleanly.
- [ ] **[Step 6–7](./PHONE_TEST.md#step-6-voice-commands-in-explore-2-min): Voice Commands & Spoken Ask Q&A** `[PASS / FAIL]`  
  Commands recognized (`where am I`, `repeat`, `next corner`, `describe`, `help`, `faster`); grounded Ask answers; fallback on unanswerable query.
- [ ] **[Step 8–10](./PHONE_TEST.md#step-8-take-photo-of-a-real-textbook-diagram-2-min): Camera, PDF & Offline Saved Diagrams** `[PASS / FAIL]`  
  Photo scene extraction; 1-page PDF rendering; Airplane Mode offline loading from IndexedDB (`ghost-touch-db`).
- [ ] **[Step 11–12](./PHONE_TEST.md#step-11-teacher-correct-mode-15-min): Teacher Correct & Hindi/Gujarati TTS** `[PASS / FAIL]`  
  Drag point with photo underlay, undo/redo, validate and save; natural Hindi/Gujarati speech playback or missing-voice notice.
- [ ] **[Step 13](./PHONE_TEST.md#step-13-guide-my-finger-talkback-off--on-pan-vs-speaker-cancel-ask-3-min): Guide My Finger (TalkBack OFF & ON)** `[PASS / FAIL]`  
  Settings toggle on; voice target `"take me to B"` (`guide.start`); speaker direction cues vs. headphone stereo pan; arrival buzz (`guide.arrived`); TalkBack pass-through guiding; Ask `"Guide me"` button; cancel via `"stop"`, Back, or 20 s timeout.
- [ ] **[Step 14](./PHONE_TEST.md#step-14-teacher-verify--share-routes-teach-link-decompression-offline-bad-links-qr-3-min): Teacher Verify & Share** `[PASS / FAIL]`  
  Teacher tools toggle on; "Open Teacher Editor" button / `#/teach` route; Mark verified; QR code generation ($\le 2000$ chars); cold open `#s=...`; offline Airplane Mode exploring; damaged link friendly error (`share.error.badFormat`).

---

### (C) After the Phone Test Passes
- [ ] **Flip Feature Defaults:** Decide whether to default `gt_guide_enabled` and `gt_teacher_enabled` to ON or keep as user-toggled features.
- [ ] **Update Submission Claim:** Tick the TalkBack physical verification row in `docs/STEMERGENT_SUBMISSION.md` and replace pending qualifiers with measured facts.
- [ ] **Record Demo Video:** Record 2:50–3:00 video following [docs/DEMO_SCRIPT.md](./DEMO_SCRIPT.md); capture physical motor hum with lavalier mic.

---

### (D) Owner-Only Content & Native Checks
- [ ] **Hindi & Gujarati Native Review:** Check translations using [docs/user-test/translation-review.md](./user-test/translation-review.md), including new `guide.*`, `share.*`, and `teach.*` keys.
- [ ] **Resolve Media `[FILL]` Markers:** Insert screenshots, GIFs, repository link, and demo video URL into `docs/STEMERGENT_SUBMISSION.md`.
- [ ] **Resolve Team `[FILL]` Markers:** Enter team member names, student details, and assigned roles (max 4 people).
- [ ] **Resolve School-Session `[FILL]` Marker:** Provide the single sentence describing the BPA Ahmedabad school session (or record an honest note if session did not take place).

---

### (E) Submission Day & Competition Deadlines
- [ ] **Re-run Automated Test Counts:** Run `npm --prefix frontend test` and `backend/.venv/Scripts/python -m pytest backend`; log exact counts in submission documents.
- [ ] **Review Deadlines:**
  - Feature Freeze: **Nov 13, 2026**
  - STEMergent Submission Target: **Nov 14, 2026** (Hard Deadline: **Nov 16, 2026, 09:00 IST**)
  - Kiro Credits Renewal: **Before Dec 1, 2026**
  - Kiroween Hackathon Deadline: **Dec 5, 2026, 03:30 IST**
- [ ] **Kiro Review Queue:** Queue prompts in [docs/handoffs/kiro-prompts.md](./handoffs/kiro-prompts.md) (Task 13 spec retro, Task 11 review, Task 17 Lab theme P18–P20 spec & properties).

---

### (F) Security Hardening & Operational Controls (Hardening Plan §e)

#### 1. Operational Decisions
- [ ] **Per-Client Daily AI Allowance (S1):** Decide value for `PAID_CALLS_PER_CLIENT_PER_DAY` on Render: `500` (safer against single-client abuse), `1000`–`1200` (recommended if 25–30 students share one school Wi-Fi NAT address), or `0` / unset (disabled per-client cap, global cap only).
- [ ] **Provider Spend Caps (S2):** Set hard monthly spend limits and billing alerts directly in provider dashboards (OpenAI project budget cap, Google AI Studio / Google Cloud billing cap, Nebius credit limit). Ensure one dedicated key per provider is used exclusively for Ghost Touch.
- [ ] **Provider Data Terms & Retention (S9):** Review current API data-use and retention terms for active billing tiers at OpenAI, Google Gemini, and Nebius Token Factory. Record dates and policies in [docs/PRIVACY.md](./PRIVACY.md); reorder or drop providers if an active tier trains on inputs.
- [ ] **Agent Dangerous Mode Policy (S10):** Enforce policy that `AGY_DANGEROUS=1` or `--dangerously-skip-permissions` runs only in isolated worktrees with no `.env` present. If dangerous mode was ever run in a workspace containing `backend/.env`, rotate all provider keys (Gemini, OpenAI, Nebius) before final submission.
- [ ] **Kiro Agent Shell Patterns (S10):** Request Kiro tighten shell patterns from `( .*)?` to `( [-\w./=:@]+)*` in `.kiro/agents/gt-*.json` and remove machine-specific temporary paths.
- [ ] **Teacher Back Confirmation Dialog (B12):** Evaluate native `window.confirm` on teacher Back navigation; decide whether to keep or replace with spoken in-app confirmation (test on phone first).
- [ ] **Render Access Logs (S8):** Decide whether to keep access logs on Render for debugging (records client IP addresses) or disable via `--no-access-log` for maximum privacy.
- [ ] **Uptime Keep-Warm Ping (B3):** Configure a free external uptime monitor (e.g. UptimeRobot or cron) to ping `GET /api/v1/health` every 10 minutes to minimize Render free-tier container cold starts.

#### 2. Dashboard Settings to Confirm
- [ ] **Render Production Settings:**
  - [ ] Service host matches CSP `connect-src` (`ghost-touch-api.onrender.com` in `frontend/vercel.json`); if host is `ghost-touch-backend-...`, update CSP and tests.
  - [ ] `ENVIRONMENT=production` is set.
  - [ ] `ALLOWED_ORIGINS` is set exactly to the production Vercel origin (`https://...`, no trailing slash, no wildcard `*`).
  - [ ] `PAID_CALLS_PER_DAY` is explicitly configured (e.g. `2000`).
  - [ ] API keys present only for active providers you intend to use.
- [ ] **Render Proxy Hop Verification:** Verify that `TRUSTED_PROXY_HOPS` (defaults to 1 on Render) correctly isolates rate-limit buckets so two devices on distinct networks do not block each other.
- [ ] **Vercel Production Settings:**
  - [ ] `VITE_API_URL` exactly matches the Render API URL with no trailing slash.
  - [ ] Feature flags configured (`VITE_FEATURE_GUIDE`, `VITE_FEATURE_SHARE`).
  - [ ] Production branch is locked to `main` only.
- [ ] **GitHub Repository Settings:**
  - [ ] Branch protection enabled on `main` (require CI, Gitleaks, and CodeQL checks to pass).
  - [ ] Secret scanning with Push Protection enabled.
  - [ ] Private vulnerability reporting enabled in Repository Settings > Security.
  - [ ] Dependabot security alerts and version updates enabled.
  - [ ] Workflow permissions set to Read-only by default; fork pull requests require approval for outside collaborators.
  - [ ] Confirm no repository secrets exist beyond essential workflow needs.
- [ ] **GitHub Action Commit SHA Pinning (S4):** Verify third-party Actions (`gitleaks/gitleaks-action`, `release-drafter/release-drafter`, `github/codeql-action`) are pinned to immutable commit SHAs.

#### 3. Phone-Only Hardening Verifications
- [ ] **Error Boundary & Crash Recovery (hx1):** Trigger a temporary test exception during render; verify crash message is spoken once and double-tapping screen reloads the app (test with TalkBack ON and OFF).
- [ ] **PWA Update Handling (hx7):** Deploy an updated build with PWA installed; confirm no unexpected reloads happen while in Explore screen, and that update reload occurs on Start or Capture screen after announcement.
- [ ] **Safe Photo Decode on Low-End Phone (hx9):** Capture a full-resolution 50 MP photo on a budget phone; verify memory downscale decodes without browser tab crashing.
- [ ] **Storage Persistence (hx9):** Confirm saved diagrams survive browser storage pressure in IndexedDB.
- [ ] **Teacher Back Navigation (B12):** Test teacher exit confirmation dialog eyes-closed without screen reader assistance.

#### 4. Deployed Site Hardening Verifications
- [ ] **Deployed Smoke Script Check:** Run `node scripts/smoke-deployed.mjs <vercel-url> <render-url>` after deployment; verify all automated checks pass.
- [ ] **Cold Start Wake-Up Resilience (hx5):** Leave app idle for 20 minutes, ask a diagram question, and verify the client announces "Waking the server" and resolves the answer after container wakes.
- [ ] **Per-Client Allowance Exhaustion (hx2):** Temporarily set `PAID_CALLS_PER_CLIENT_PER_DAY` to a small number, exhaust the budget from one network, and verify it falls back to Raw Mode (`budget_exhausted`) while a second network continues receiving AI responses.
- [ ] **Multi-Network Rate Limit Isolation:** Confirm rate limits on one device do not throttle a separate device on a different network.

