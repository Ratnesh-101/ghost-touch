# Red-team: backend abuse and cost (Claude Opus subagent, read-only static attack, 2026-11-08)
Committed code only; nothing run or sent. **Supervisor has not re-verified.**
**GAP RESOLVED: A1/A2 were re-done as the "Follow-up: /ask cost and limits" section at the end of this file.** (The first agent's reply was cut off, so its A1/A2 were not delivered.)

| ID | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| A3 | HIGH | raw_mode.py:65-115; main.py:582-590 | Raw Mode edge detection runs on the full image (up to 12 MP); edge list is turned into Python objects and sorted before the 1000 cap; on timeout the request frees its slot but the thread keeps running; several can pile up on the 512 MB instance. (Round 2 added a Raw Mode candidate cap in the uncommitted/T25 work; check it.) | Downscale to <=1600 px before edge detection; keep only the longest ~2000 before the Python loop; hold the slot until the thread finishes. |
| A4 | HIGH | main.py:539, 666-701; vision/chain.py:122-155 | Cache key is a hash of exact bytes, so any changed byte misses. An invalid model answer leads to ~3 paid calls; temporary provider errors up to 6 per attempt; Raw Mode results never cached; the global 2-slot limit lets a few slow requests cause 503 `queue_timeout` for real users. | Daily per-IP and global caps on paid calls; perceptual-hash cache key on a downscaled copy; briefly cache "invalid" per hash; at most one extra call per request. |
| A5 | MED | main.py:512-527 (before slot at 548) | Uploads (~20 MB, chunks plus joined copy) are held in memory while waiting up to 6 s for a slot. | Take the slot before reading; cap in-flight uploads in `RequestGuardMiddleware`; build bytes once. |
| A6 | MED | limits.py:51-78 | Per-IP only, no global budget; many IPs or IPv6 rotation multiply limits. Rightmost `X-Forwarded-For` entry is right only if Render adds exactly one hop (SUSPECTED); with two hops every user shares one bucket. (T25 changed this; check.) | Log the forwarded header once on the deployed server; group IPv6 by /64; global spend limit. |
| A7 | MED CONFIRMED path | vision/prompts.py; ask.py:346 | Text printed in an uploaded image is copied into `facts`/labels; `clamp_answer` does not remove URLs or instructions, so a planted worksheet can get attacker-chosen text spoken to a blind student. | Remove URLs/emails/phone numbers from scene text and answers; short label caps; mark AI source when read aloud. |
| A8 | LOW | headers/errors | `X-Vision-Provider` reveals provider exhaustion; 415 echoes content type; 422 echoes validator messages and image dimensions. No secret leaks found. | Return only `ai`/`raw`; provider names to server logs only. |

Checked, not exploitable: path tricks (guard normalisation and Starlette agree), HTTP/2 (handled by Render's proxy), decompression bombs (header checks match decoder), animated WebP (first frame only), improve pass (off by default, one slot, skipped when busy), cache growth (64 entries), rate-limit table (cleared regularly).

Worst scenario (agent's estimate, **unverified**): one script on one IP loops large `/ask` requests at the 40/min limit, roughly $2-4.5k/day with no image upload. Quickest single fix: a **hard budget on the OpenAI/Gemini/Nebius project dashboards** plus an `/ask` prompt size limit. **Owner action: set provider spend caps now.**

---
## Follow-up: /ask cost and limits (A1/A2 re-done as a defensive review, Claude Opus subagent, 2026-11-08)
Verdict: **fix first.** Per-client rate and time limits exist but no cap on spend. Measured by the agent locally (no network). Supervisor has not re-verified. Code reviewed = committed `dabd499`/`abd4640`.

| ID | Sev | Location | Finding | Minimal fix |
|---|---|---|---|---|
| C1 | High | whole app | No global daily budget or circuit breaker on paid calls. Many IPs or one IPv6 /64 spend without limit. | `paid_budget.py` with `try_consume(n)`, UTC-date counter + lock, `PAID_CALLS_PER_DAY` (default 2000, 0 = off), checked before every `provider.complete`/`extract` incl. retries; when spent use `facts_lookup`/Raw Mode, log once. Tests with injected clock. |
| C2 | High | ask.py:293, 216-262 | Prompt is `json.dumps(indent=2)` with `ensure_ascii=True`, ids appear twice. A 512 KB body becomes 744K chars (ASCII, 1.42x), 1.45M (Devanagari, 2.78x), 2.16M (`é`, 4.18x). The 512 KB body limit is the only real bound (count caps allow ~1.6M chars). | `ensure_ascii=False`, no indent, cap prompt ~24K chars, else drop coordinates or answer from `facts_lookup`. |
| C3 | Med | gemini.py:216-219; openai_provider.py:27-28 | `complete()` sets no `max_output_tokens`; long output is paid before `clamp_answer` cuts to 300 chars. | `max_output_tokens`~256; lower OpenAI `COMPLETE_MAX_TOKENS`. |
| C4 | Med | main.py:68, 757 | Concurrency cap 4 is global, rate limit per IP: one IP at 40/min with ~10 s calls can hold all 4 slots and lock others out. | Per-client in-flight cap of 1-2. |
| C5 | Med | chain.py:180-213; gemini.py:231-250 | One `/ask` can make up to 3 providers x 2 attempts = 6 calls (+1 Gemini thinking-config retry, ~7). | `PROVIDER_RETRIES=0` for `/ask`, or charge each attempt to the budget. |
| C6 | Low | ask.py:857 | `facts_lookup` runs only after the model fails. | Run first, accept score >= 10. |
| C7 | Low | limits.py:79 | Rate-limit state in memory per process; extra workers multiply limits. | Document or keep one worker. |

Answers: (1) caps: body 512 KB, question 500 chars, 500 points/1000 segments/50 polylines/100 bars/100 facts, text 300 chars, polyline points 2000 (parse-only; >10 points summarised in prompt), lang 35. Worst valid prompt ~0.74M chars (~200K tokens) ASCII, ~2.2M chars (~1M tokens) with escaped non-ASCII. (2) Only `semantic_ask` (ask.py:789) answers before the model, and an abuser avoids its phrases; otherwise 1 to ~7 calls, bounded by `ASK_TIMEOUT_SECONDS=10` and 8 s per call. (3) 40 req/min per client key, concurrency 4, 5 s queue wait; on disconnect the route polls every 0.25 s, cancels and awaits, then frees the slot (main.py:771-786); input tokens are likely already billed; if Render's proxy does not pass the disconnect on (UNVERIFIED) the call runs to its timeout. (4) none, design above. (5) Worst case one IP, 40 req/min = 57,600 calls/day at assumed $0.10/1M input tokens: ~$1,150/day (ASCII ~200K tokens) to ~$5,800/day (escaped ~1M tokens), x2-3 with C5 retries, ~3x at Flash pricing; a free-tier key just exhausts quota (lost service, no bill). With C2 + C1 fixed: about $1/day. (Pricing assumptions are the agent's, unverified.)

Note: the agent found no uncommitted backend edits; Kiro's T25 backend work was committed by Claude Code as `dabd499`.

Decisions for owner: default `PAID_CALLS_PER_DAY`; `PROVIDER_RETRIES=0` for `/ask`. Also set hard provider spend caps on the dashboards now.
