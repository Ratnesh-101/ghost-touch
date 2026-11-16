# Report: Lane hx10 (Security Documentation & Operational Runbook)

- **Status:** DONE
- **Tool:** Antigravity (agy), headless mode
- **Lane:** hx10
- **Date:** 2026-11-16

---

## 1. Purpose & Scope

Write down the operational security controls and procedures so the repository owner can safely and confidently operate Ghost Touch in production. This task is strictly documentation and operational checklists using only verified facts from the codebase and the hardening plan (`docs/reports/fable-hardening-plan.md` sections c and e).

---

## 2. Changes Made

### 2.1 `SECURITY.md` (New, Repository Root)
Created the repository root security policy in plain language:
- **Supported Versions:** Identifies the `main` branch as the only actively supported version.
- **Private Reporting:** Documents how to report security vulnerabilities privately via GitHub Private Vulnerability Reporting (`Security` -> `Advisories` -> `Report a vulnerability`), with explicit instructions not to file public issues or pull requests.
- **Data Storage Boundaries:** Clarifies what the app stores and does not store (no user accounts, no telemetry/trackers, no server database, no image/audio persistence on disk; local IndexedDB and localStorage on device only; ephemeral RAM cache and rate-limit counters on server).
- **Two-Line Control Summary:** Concise two-sentence overview of Ghost Touch's defensive controls (size/type caps, rate limits, OpenCV Raw Mode fallback, TLS/HTTPS, server-only secret redaction, and client-side URL hash sharing).

### 2.2 `docs/SECURITY_RUNBOOK.md` (New)
Authored a step-by-step operational runbook for the repository owner covering:
- **(a) Emergency Kill Switch:** Instructions to set `PAID_CALLS_PER_DAY=0` in Render environment variables, causing `backend/app/paid_budget.py` to immediately stop external paid API calls and seamlessly fall back to local OpenCV Raw Mode edge extraction and deterministic `facts_lookup`.
- **(b) Key Rotation:** Standardized zero-downtime rotation procedures (generate new key -> update Render env -> redeploy/verify health -> delete old key) with dedicated paragraphs for Google Gemini, OpenAI, and Nebius Token Factory. Contains zero key values.
- **(c) Restart Volatility:** Explicitly documents what resets on process restart, deployment, or waking from sleep on Render (daily budget counters, rate-limiting `_HITS` table, 64-entry scene cache, and client IP ledgers). Explains why provider-side billing caps are required.
- **(d) Per-Client Budget & Classroom Tuning:** Explains the role of `PAID_CALLS_PER_CLIENT_PER_DAY` in preventing single-device quota exhaustion. Provides specific tuning guidance for classroom NAT environments where 25–30 students share one public IP address (recommendation: 1000–1200 calls/day vs. default 500).
- **(e) After-Deploy Smoke Command:** Documents the automated check command (`node scripts/smoke-deployed.mjs <vercel-url> <render-url>`) and the 8 pass/fail criteria it verifies without transmitting image data or API keys.
- **(f) Automated Agent Guardrails:** Documents strict rules for autonomous/headless agents (dangerous mode only in separate worktrees without `.env`; no untrusted input; separation of network tools and shell; orchestrator gate verification; push-time secret scans; key rotation on misbehavior).

### 2.3 `AGENTS.md` (Updated)
- Appended a new **Permission modes** section defining restrictions on dangerous execution flags, workspace isolation, prohibition of simultaneous network + shell capabilities, requirement for orchestrator review, and cross-reference to `docs/SECURITY_RUNBOOK.md`.

### 2.4 `docs/PRIVACY.md` (Updated)
- Maintained the **UNVERIFIED** status on third-party provider data retention and training policies.
- Removed prior phrasing stating OpenAI does not train on API inputs; ensured no provider is claimed to train or not train on user data.
- Added Section 10.1: **Owner Action: Provider Data Terms Register** with a structured table for the repository owner to log terms URLs, retention durations, training policies, and verification dates.
- Noted known audit gap B13 in Section 6.1 and Section 11 regarding `val_result.errors` logging in `backend/app/main.py:361` during invalid improve passes (addressed by hardening lane hx3).

### 2.5 `docs/OWNER_CHECKLIST.md` (Updated)
- Added new section **(F) Security Hardening & Operational Controls (Hardening Plan §e)** containing all items from section (e) of the hardening plan as unticked checkboxes (`- [ ]`):
  1. Operational Decisions (per-client budget, provider spend limits, provider data terms review, agent dangerous mode policy, Kiro shell patterns, teacher confirm dialog, Render access logs, keep-warm ping).
  2. Dashboard Settings to Confirm (Render production host matching CSP, proxy hops, Vercel API URL, GitHub push protection, private vulnerability reporting, Action commit SHA pinning).
  3. Phone-Only Hardening Verifications (error boundary crash speech, PWA update reload, safe photo decode, storage persistence, teacher Back confirm).
  4. Deployed Site Hardening Verifications (smoke script execution, cold start resilience, per-client budget exhaustion behavior, multi-network rate-limit isolation).

---

## 3. Tests Added
- **None.** This was a documentation-only task. No source code or existing test files were modified.

---

## 4. What Could Not Be Verified

The following items are outside the scope of a local headless run and require owner or external verification:
1. **Third-Party Provider Policies:** Internal data retention periods and training policies for Google Gemini, OpenAI, and Nebius Token Factory cannot be verified from repository code. These require owner review of the active billing tiers and recording in `docs/PRIVACY.md`.
2. **Dashboard Configurations:** Settings in Render (production hostname, `PAID_CALLS_PER_DAY`, `ALLOWED_ORIGINS`), Vercel (`VITE_API_URL`), and GitHub (private vulnerability reporting toggle, push protection, branch rules) must be verified directly in their respective web consoles.
3. **Physical Hardware & Production Network Behavior:** Phone behavior (TalkBack gestures, camera decode on low-memory devices) and deployed network tests (cold-start wake-up, multi-network rate-limit buckets) require real physical devices and live production endpoints.
4. **Shell Gate Execution:** Per the headless execution rules of this run, no shell commands (`npm`, `python`, `git`, `curl`) were run. All gates are run by the orchestrator.
