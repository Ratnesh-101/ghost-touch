# Ghost Touch backend: the 3 a.m. review

Date: 2026-11-17. Author: Claude Code, in the voice of a paranoid backend/SRE reviewer. Base commit: `a82f7bf` on `main` (hx2 and hx3 merged).

Method: static reading only. Nothing was run, measured, scanned or exploited. No `.env` file was opened (`backend/.env.example` is blocked in this session and was not read). Every timing, memory figure, price and Render behaviour below is an **estimate or assumption** and is labelled as such; the code references are verified by reading.

Read first, and not repeated here: `docs/reports/fable-hardening-plan.md` (B1-B13, S1-S11, lanes hx1-hx11), `docs/reviews/kiro-review-hx2.md`, `docs/reviews/kiro-audit-2026-11-12-backend.md`, `docs/SECURITY_RUNBOOK.md`. Known and already owned, so only referenced: budget resets on restart (S2), provider spend caps (owner), `TRUSTED_PROXY_HOPS` unverified (hx2 review #4), CSP host mismatch (S5), provider data terms (S9), keep-warm ping (owner item 8), fail-open `PAID_CALLS_PER_CLIENT_PER_DAY` parse (hx2 review #3, still open at `paid_budget.py:82-98`).

---

## 1. Verdict

**The request path is carefully defended against a hostile stranger and badly tuned for a friendly classroom.** Every limit in this service is per IP address, and the target user sits behind a school router with 29 classmates. The second theme: **the service is blind to itself.** The health check says "ok" when no AI key is loaded, when CORS dropped every origin, and when the budget is spent, and the only latency and provider telemetry is logged at a level production discards. The third theme: **one slow provider is a full brownout**, because there is no circuit breaker and only two scene slots.

Nothing here is a data-loss or key-leak bug. All of it is the kind of thing that fails live, in front of a blind student, with no alert.

| # | Finding | Sev |
|---|---|---|
| SRE-01 | Per-IP caps (2 in flight, 20 scenes/min) lock out a classroom behind one NAT | High |
| SRE-02 | No circuit breaker: a hanging first provider costs every scene 12 s and collapses throughput | High |
| SRE-03 | App `INFO` logs are never emitted; health is always green; you cannot see provider, latency, or "no key" | High |
| SRE-04 | Budget is charged per attempt, not per success; a provider outage drains a client's day at up to 6x | Med |
| SRE-05 | `--limit-concurrency 64` overload answers without CORS headers: browsers report "network error", and the health check shares the limit | Med |
| SRE-06 | Per-client in-flight cap is taken after the upload is fully buffered; slow uploads are not bounded in time | Med |
| SRE-07 | Raw Mode gets a 2.5 s reserve on a 0.1 vCPU instance; "never fails" may fail exactly when AI timed out | Med |
| SRE-08 | Ask gives the first provider the whole 10 s budget; the fallback chain never runs on a hang | Med |
| SRE-09 | CPU-bound validation and semantic code runs on the event loop; max-size `/ask` and `/validate` bodies can stall health checks | Med |
| SRE-10 | Render deploys every push to `main` regardless of CI; no graceful-shutdown bound | Med |
| SRE-11 | Scene after 15+ idle minutes on Capture is not re-warmed; boot plus processing can exceed the 65 s client timeout | Med |
| SRE-12 | Rate-limit 429 has no `Retry-After`; client retries have no jitter | Low-Med |
| SRE-13 | Production provider order puts the paid model first; the code default and the project docs say Gemini first | Low-Med (cost) |
| SRE-14 | Schema has one frozen `version: Literal[1]` and no compatibility corpus for saved/shared scenes | Low-Med |
| SRE-15 | Small ones: cache hit waits in the AI queue, cache stampede, improve-provider client leak, privacy wording on temp files, fail-open production flag | Low |

---

## 2. Findings

### SRE-01 · High · a classroom behind one router is treated as one abuser
Where: `backend/app/limits.py:43` (`DEFAULT_CLIENT_MAX_IN_FLIGHT = 2`), `limits.py:232-234` (rate limit), `backend/app/main.py:603-614` (in-flight 429), `render.yaml:62-63` (`RATE_LIMIT_SCENE_PER_MIN=20`). `SCENE_CLIENT_MAX_CONCURRENCY` and `ASK_CLIENT_MAX_CONCURRENCY` are not set in `render.yaml`, so 2 applies.
Scenario: the teacher says "everyone photograph figure 3". Thirty phones post from one public address. The limiter admits 20 in that minute and rejects 10. Of the 20, two get a slot and 18 get `429 Retry-After: 1`. Their automatic retry one second later lands in a rate window that is already full, so it is rejected too. Two students out of thirty get a diagram in the first minute; the rest hear a busy message. The runbook's classroom section tunes only the daily budget (`docs/SECURITY_RUNBOOK.md:61-65`), not these two caps.
Minimal fix: (1) add `SCENE_CLIENT_MAX_CONCURRENCY` and `ASK_CLIENT_MAX_CONCURRENCY` to `render.yaml` and document a classroom profile (for example in-flight 8, scenes 60/min) next to the budget numbers in the runbook. (2) Count only admitted work against the rate window: a request rejected by the in-flight cap should not have used one of the 20. (3) Operational answer that needs no code: the teacher scans once and sends the share link; shared scenes never touch the backend.

### SRE-02 · High · no circuit breaker, so one slow provider is everyone's outage
Where: `backend/app/vision/chain.py:122-162` (every request walks the full chain from the top), `render.yaml:42-45` (`openai,gemini,nebius`, 12 s per call), `main.py:77` (2 scene slots), `main.py:78` (6 s queue wait).
Scenario: the first provider accepts connections but does not answer (the common partial-outage shape). Every scene burns the full 12 s timeout before the second provider is tried with about 10 s left. With two slots that is roughly 6 to 8 scenes per minute for the whole service (estimate). Everyone else waits 6 s and gets 503. Nothing remembers that the provider was dead ten seconds ago. The same happens with a 429 storm: each request pays one attempt, a 0.8 s sleep and a second attempt before moving on.
Minimal fix: a small breaker in `ProviderChain`: per provider, after 2 consecutive timeouts, 5xx or 429, skip it for 60 s, then let one probe through. About 30 lines, pure, easy to property-test (never skips a healthy provider; always re-probes). Also drop `PROVIDER_TIMEOUT_SECONDS` for the first provider to the measured p95 plus margin once SRE-03 makes p95 visible.

### SRE-03 · High · the service cannot tell you what it is doing
Where: no `logging.basicConfig`, `dictConfig` or `--log-level`/`--log-config` anywhere in `backend/app` or `render.yaml:10`. uvicorn configures only its own loggers; the root logger stays at WARNING. `main.py:541-544` health returns `{"ok": true}` unconditionally.
What is lost: `scene processed: provider=… mode=… reason=… elapsed_ms=…` (`main.py:755-760, 785-790`), every `ask processed` line (`ask.py:1000, 1055, 1071, 1096, 1113`), `vision providers: (none)` at start-up (`vision/__init__.py:56`), `allowed CORS origins` (`main.py:453`), cache hits (`main.py:665`), "budget exhausted; using Raw Mode" (`main.py:771`). The Kiro audit noticed this and chose not to report it. I am reporting it: these are the only metrics the service has.
Scenario: a key is mistyped in the dashboard. The provider is skipped silently, health is green, the smoke script passes, and every student gets Raw Mode with `reason: no_provider` until someone looks at a phone. Or: scenes take 14 s instead of 5 s and nobody can say which provider, since when, or how often.
Minimal fix: (1) in `lifespan`, set the `app` logger to INFO with one stream handler and a fixed format (keep uvicorn's own config). (2) Add `GET /api/v1/status` returning coarse, non-sensitive facts: `ai_available` (providers configured and budget not exhausted), `providers_configured` (count), `uptime_seconds`, `commit` (from `RENDER_GIT_COMMIT`), `scene_schema_version`. No counts of budget remaining (do not hand an abuser a gauge). (3) Point `scripts/smoke-deployed.mjs` at it and fail when `ai_available` is false. (4) One summary log line per 100 requests or 10 minutes with counts by mode and reason, so a log search is a dashboard.

### SRE-04 · Medium · budget charged for failures
Where: `try_consume(1)` runs before the network call in `vision/gemini.py:193, 225, 280, 308`, `vision/openai_provider.py:95, 109`, `vision/nebius.py:78, 92`. Nothing refunds on 429, 5xx, connect error or timeout.
Scenario: providers are flapping for 20 minutes. Each scene attempt can charge 2 units per provider across 3 providers (`PROVIDER_RETRIES=1`), so up to 6 units for zero scenes, and the equation route and validation retry walk the chain again. A classroom's 500 is gone before the providers recover, and the class stays in Raw Mode until UTC midnight (05:30 IST, which at least falls before the school day). A permanently bad key (401) silently taxes every request one unit forever.
Minimal fix: refund on failures where the provider demonstrably did no billable work: connect error, 401/403, 429, and 5xx. Keep the charge for timeouts and for 200 responses that fail validation (those were billed). Add a Hypothesis property: consumed never goes negative, never exceeds the cap, and equals successes plus billable failures. The breaker in SRE-02 removes most of the waste on its own.

### SRE-05 · Medium · the hx3 concurrency limit fails in a way the client cannot read
Where: `render.yaml:10` (`--limit-concurrency 64`), `frontend/src/api/scene.ts:232-236` (anything that is not a readable response becomes `network`).
Scenario: at the limit uvicorn itself answers 503, before any middleware, so there is no `Access-Control-Allow-Origin` and no `Retry-After`. A browser cannot read that response; `fetch` rejects; the client classifies it as `network`, does not retry, and tells a blind student to check their connection when the truth is "busy, try again". Second problem (assumption about Render): the health check connects through the same listener, so at the limit it also gets 503; enough of those and the platform restarts the instance, which wipes budget, cache and rate limits (see S2) in the middle of the busiest moment.
Minimal fix: keep the flag as a last-resort memory guard but make sure the app sheds load first, with CORS headers: an ASGI-level global in-flight counter inside `RequestGuardMiddleware` (which sits inside `CORSMiddleware`) that returns `503 Retry-After: 5` at, say, 48. Then set the uvicorn limit well above it (96). Verify on the deployed site what a browser sees at overload; this cannot be confirmed from the repo.

### SRE-06 · Medium · the per-client cap starts counting too late
Where: `main.py:552` (`image: UploadFile = File(...)`): FastAPI parses the whole multipart body before the handler runs. The in-flight cap is acquired at `main.py:603-606`, after that. The "streaming" loop at `main.py:630-642` reads an already-buffered file. `limits.py:259-266` caps bytes but not time.
Scenario: a client opens 20 uploads a minute (the rate limit) and trickles each one. None of them holds an in-flight slot or a semaphore, but each holds a uvicorn connection. A few minutes of that from a handful of addresses reaches the 64 limit and SRE-05 takes over for everyone. Unverified: Render's proxy may buffer request bodies and blunt this; confirm before spending effort.
Minimal fix: move the per-client in-flight acquire into `RequestGuardMiddleware` (before the body is read) and add a body deadline in `guarded_receive` (for example 20 s total, then 408). Both are a few lines in a file that already has the client key.

### SRE-07 · Medium · Raw Mode's reserve was sized for a real CPU
Where: `main.py:76` (`RAW_MODE_RESERVE_SECONDS = 2.5`), `main.py:686-712` (timeout gives 504), `raw_mode.py:46-70` (pure-Python quadratic de-duplication over up to 1000 candidates), `render.yaml:8` (`plan: free`).
Scenario: the AI path uses its whole 22.5 s and times out. Raw Mode now has 2.5 s to decode, blur, run Canny, trace contours and run up to about a million `math.hypot` calls in Python, on what I assume is a 0.1 vCPU share that the event loop is also using. If it misses, the student gets a 504, not outlines, on the one path the product promises never fails. After the 504 the worker thread keeps running (OpenCV calls cannot be interrupted; cancellation is checked only between stages) while the semaphore is released, so slow threads can stack up and compete for the same sliver of CPU and for memory.
Minimal fix: measure first (see section 6, check 3). Then either start Raw Mode in parallel with the AI call when the instance is idle and keep its result as the ready fallback, or raise the reserve to what the measurement says and take it out of the AI budget. Replace the quadratic de-dup with a grid hash keyed on rounded endpoints (linear). Do not release the scene slot until the worker thread has really finished.

### SRE-08 · Medium · Ask's fallback chain is decorative when the first provider hangs
Where: `ask.py:1034-1039` calls `chain.complete(prompt, deadline=start+10, max_attempts=1)` with no `timeout`, so `chain.py:203, 210` uses `min(call_timeout=12, remaining=10)`: the first provider gets all 10 s. The second gets `deadline reached`.
Scenario: first provider slow, second healthy. Every Ask waits 10 s and then answers from the facts table or says "I don't know", while a working model was one hop away.
Minimal fix: pass `timeout=min(chain.call_timeout, total_budget * 0.55)` so two providers fit. One line plus a test with a fake slow first provider.

### SRE-09 · Medium · heavy synchronous work on the only event loop
Where: `ask.py:737-742` (Pydantic validation of a scene up to `MAX_ASK_BODY_SIZE` 512 KB, `MAX_POLYLINE_POINTS` 2000 x 50), `ask.py:988-990` (`_semantic_ask`) and `ask.py:1094` (`facts_lookup`) run before and without any model call; `main.py:1018-1036` `/validate` has no semaphore and no in-flight cap at all.
Scenario: a client sends maximum-size scenes to `/ask` or `/validate` at 40 per minute. No paid call happens, so the budget never notices. Each request is pure CPU on the event loop; at a fraction of a core (assumption) that may be a second or more each, during which health checks, uploads and other students' requests do not move.
Minimal fix: measure one worst-case body (section 6, check 4). If it is over about 100 ms, run validation plus semantic plus facts in `asyncio.to_thread` under the existing ask semaphore, give `/validate` the same semaphore, and cut the Ask body cap to what a legitimate 1000-point scene needs.

### SRE-10 · Medium · a red `main` still ships, and deploys cut live requests
Where: `render.yaml` has no deploy trigger setting, so the default (deploy on every commit) applies; `render.yaml:10` has no `--timeout-graceful-shutdown`.
Scenario: a lane merges with a failing backend job; Render builds and serves it anyway. Separately, any deploy during school hours kills in-flight scenes; the client sees `network` and does not retry.
Minimal fix: set the blueprint to deploy only after checks pass (confirm the exact key in Render's blueprint reference; I believe it is `autoDeployTrigger: checksPass`). Add `--timeout-graceful-shutdown 25`. Add a CI step that starts the exact `startCommand` from `render.yaml` with `ENVIRONMENT=production` and no keys, curls health, and stops: today a typo in that line is found in production. Runbook rule: no deploys 08:00 to 16:00 IST on school days.

### SRE-11 · Medium · the scene path still has the cold-start gap that hx5 closed for Ask
Where: `warmBackend()` is called only at `frontend/src/App.tsx:343` (page load) and `frontend/src/flow/ask.ts:309, 451`. `frontend/src/api/scene.ts:28` (`SCENE_TIMEOUT_MS = 65_000`). `docs/DEPLOY.md:250` states boot is 30 to 60 s, up to 70 s.
Scenario: the app is opened at the start of class, the teacher talks for 20 minutes, the instance sleeps. The first photo then needs boot (30 to 70 s) plus processing (up to 25 s, `render.yaml:52-53`). That can exceed 65 s; `timeout` is not retried. The student waited over a minute and got an error.
Minimal fix: call `warmBackend()` when Capture is shown and again when a photo is picked (the downscale gives it a head start). Treat a first-attempt `timeout` with no response as "waking" and retry once inside a 120 s outer budget, announcing it. The keep-warm ping in the owner checklist removes most of this; do both.

### SRE-12 · Low-Med · retries that cannot succeed, all at the same instant
Where: `limits.py:316-329` (`_reject` sends no `Retry-After`), `frontend/src/api/scene.ts:185-198` (waits exactly the header value, default 3 s, no jitter).
Scenario: a rate-limited client retries after 3 s into a 60 s window that is still full: a guaranteed second failure. And when 50 clients receive `Retry-After: 5` together they all come back in the same 100 ms.
Minimal fix: send `Retry-After` on the rate-limit 429 computed from the oldest hit in the window (clamped to 60). In the client add 0 to 30 percent random jitter to the wait, and do not auto-retry when the server asks for more than 10 s; say "busy, try again in a minute" instead.

### SRE-13 · Low-Med · the bill depends on a provider order nobody wrote down as a decision
Where: `render.yaml:42-43` (`openai,gemini,nebius`) versus `vision/__init__.py:20` (`gemini,openai,nebius`) and the project's own "Gemini, free tier suits a student". `openai_provider.py:33, 102`: 4096 output tokens, `detail: high`.
Scenario: not a failure, a surprise. Production sends every scene and every Ask to a paid model first. Also, 4096 output tokens can truncate a 150-point polyline; truncated JSON fails validation, which triggers the validation retry (same truncation) and then the equation rescue: three paid calls for one predictable failure.
Minimal fix: record the order as an owner decision with the cost table in section 4. Log (at INFO, once SRE-03 is done) a `finish_reason=length` counter; on truncation skip the validation retry and go straight to the equation route.

### SRE-14 · Low-Med · one schema version, no compatibility promise
Where: `backend/app/schema.py:84` (`version: Literal[1] = 1`); `ask.py:733` types the request scene as the current `DiagramScene`; no `extra` policy in `schema.py`, so unknown fields are silently dropped.
Scenario: scenes live for months on phones (saved diagrams) and in share links, and come back through `/ask` and `/validate`. The first time the model is tightened or bumped to version 2, every older saved scene gets a 422 on Ask and the student hears a generic failure. In the other direction, a newer frontend field is silently stripped by `/validate`, so a teacher's correction can lose data without an error.
Minimal fix: write the rule down ("version 1 validators may loosen, never tighten; a breaking change is version 2 and the backend accepts both with an upgrade function"). Add a pytest corpus: every fixture and sample, plus a frozen copy of today's, must pass `AskRequest` and `/validate` forever. Have the frontend map a 422 from Ask to a specific sentence ("this saved diagram is from an older version; scan it again").

### SRE-15 · Low · small things that will each cost someone an hour
- Cache hit waits in the AI queue: the lookup at `main.py:659-666` happens after `acquire_slot` (`main.py:621`). A repeat image, which needs 1 ms, can wait 6 s and get 503. Read and hash before taking the slot.
- Cache stampede: 30 students upload the identical teacher-sent file; all miss together and all pay (`scene_cache.py` has no single-flight). A per-key `asyncio.Future` map fixes it. Realistically the cache only ever hits for identical bytes, so do not count on it for cost.
- `get_improve_provider` (`main.py:246-260`) builds a new `GeminiProvider` and SDK client on every scene request when `GEMINI_IMPROVE_MODEL` is set, and nothing closes them. It is off in `render.yaml`; cache the instance before anyone turns it on.
- Privacy wording: "images are never written to server disk" (`docs/DEPLOY.md:268`, `docs/PRIVACY.md:227` marked VERIFIED). Starlette spools multipart files above about 1 MB to an anonymous temporary file that is deleted on close. The app's own uploads are usually smaller, but the absolute claim is not exact. Reword to "not stored; large uploads may pass through a temporary file that is deleted when the request ends".
- `is_production()` (`main.py:416-418`) fails open: if `ENVIRONMENT` is ever missing, docs are public and the origin filter is off. Treat the presence of `RENDER` as production too.
- `filter_production_origins` drops a mistyped origin and logs one error (`main.py:435-440`); the service then runs with CORS allowing nobody and a green health check. Fail start-up in production when the filtered list is empty.
- The lock has uvicorn's `[standard]` extras (`watchfiles`, `websockets`, `pyyaml`, `python-dotenv`) that production never uses: import time and audit surface for nothing.

---

## 3. What breaks first under 100 students at once

Assumptions: Render free instance (assumed 512 MB, about 0.1 vCPU), settings as in `render.yaml`, each phone uploads a downscaled JPEG well under 1 MB, typical AI scene 3 to 8 s (`docs/DEPLOY.md:258`). Not load-tested; this is arithmetic on the configured limits.

**Case A: one school network (the realistic one).**
1. t = 0 s: the per-IP rate limit admits 20 uploads and rejects 80 with a 429 that has no `Retry-After` (SRE-12). First thing to break.
2. Of the 20, the per-client in-flight cap lets 2 through; 18 get `429 Retry-After: 1` (SRE-01).
3. t = 1 to 3 s: all 98 retry automatically; the window is full; all 98 fail and the phones announce "busy".
4. Result: about 2 percent success in the first minute, then at most 20 admitted per minute while students retry by hand. The server itself is nearly idle. Budget, memory, CPU and providers never come under load.

**Case B: 100 separate addresses.**
1. t = 0 s: uvicorn accepts 64 connections and answers the other 36 with a bare 503 that browsers report as a network error (SRE-05). First thing to break.
2. The 64 uploads are parsed on the event loop; 2 take scene slots (`main.py:77`); 62 wait.
3. t = 6 s: about 2 to 4 scenes are done; roughly 60 get `503 Retry-After: 5`.
4. t = 11 s: they all retry in the same instant (no jitter), 64 are admitted again, the rest get the bare 503.
5. t = 17 s: second 503 for almost everyone; clients stop. Roughly 6 to 10 of 100 have a diagram.
6. Steady state: about 15 to 25 scenes per minute for the whole service, until students give up.
7. If a provider is slow at that moment, divide by three (SRE-02). If the health check starves, the instance may restart and everything in memory resets (assumption about Render).

What does **not** break at 100 honest students: memory (only 2 decodes at once), the daily budget (about 130 to 200 calls), provider rate limits at 2 concurrent calls.

What to say before a class today, with no code change: the teacher scans the diagram once and shares the link; students open it and explore with zero backend calls. Only Ask touches the server, at 4 concurrent, 40 per minute per address, 2 in flight per address, which has the same NAT problem at a smaller scale.

**Memory, where it would go if it did break (all estimates, none measured).**

| Consumer | Estimated size | Bounded by |
|---|---|---|
| Python with FastAPI, OpenCV, NumPy and the Gemini SDK loaded | 150 to 250 MB | nothing; this is the floor |
| One Raw Mode decode of a 12 MP image (colour 36 MB, grey 12 MB, a rotated copy for EXIF 36 MB) | up to about 85 MB | 12 MP cap (`image_utils.py:274-282`) |
| The same image decoded again for an inline provider call (`_openai_compat.py:176`) | up to about 40 MB | runs in a worker thread, same request |
| Upload buffer plus the `bytes(buf)` copy (`main.py:631-651`) | up to 20 MB per request in a slot | 2 scene slots |
| Raw Mode threads that outlived their 504 (SRE-07) | up to about 85 MB each, briefly | nothing: the slot is already released |

Honest phones send about 2 MP, so the real figure is a sixth of this. A client that posts 12 MP PNGs straight to the API, with providers timing out, is the case that could approach an assumed 512 MB limit; an out-of-memory kill is one more way to restart the process and refill the budget (S2). Measurement 3 in section 6 settles it.

---

## 4. Cost model

**Everything in this section is an assumption to be replaced with real numbers** from the provider consoles: list prices for the configured paid model taken as about $0.40 per million input tokens and $1.60 per million output tokens; a high-detail image plus the extraction prompt and schema taken as 3,000 to 5,000 input tokens; token counts not measured. Gemini's free tier is assumed to have a low per-minute and per-day request quota. Render free is assumed to be $0 with 750 instance-hours a month, sleep after 15 idle minutes; the smallest paid instance assumed around $7 a month with no sleep.

| Item | Paid calls | Assumed tokens (in / out) | Assumed cost |
|---|---|---|---|
| Scene, typical (one extract) | 1 | 4k / 0.6k | $0.003 |
| Scene, graph (extract + equation route) | 2 | 8k / 1k | $0.005 |
| Scene, worst inside the 22.5 s AI budget (extract, retry, rescue, truncated outputs) | 3 to 5 | 20k / 12k | $0.03 |
| Ask, typical | 1 | 1.5k / 0.1k | $0.001 |
| Ask, worst (prompt at the 24,000-character cap, `ask.py:55`) | 1 | 8k / 0.25k | $0.004 |
| Cache hit, Raw Mode, facts answer, shared-link open | 0 | 0 | $0 |

| Scenario | Calls per day | Assumed cost per day | Per month |
|---|---|---|---|
| One student, one session (5 scenes, 15 asks) | about 22 | $0.03 | n/a |
| One class of 30, one school day (runbook figure 1,050 calls) | 1,050 | $1.50 to $3 | $30 to $60 (20 school days) |
| Global cap fully used, ordinary content | 2,000 | $4 to $6 | $120 to $180 |
| Global cap fully used by hostile requests built for maximum tokens | 2,000 | about $18 | about $540 |
| Abuse that also resets the counter (sleep, crash or deploy restarts the process; see S2), bounded only by 2 scene slots and 4 ask slots | 40,000 to 60,000 (theoretical ceiling) | $150 to $500 | not survivable |
| Same traffic with Gemini first on a free tier | n/a | $0 until the free quota runs out, then the paid fallback | depends on quota |
| Render free instance | n/a | $0 | $0 |
| Keep-warm ping every 10 minutes | 0 paid calls | $0 | uses about 744 of the 750 free hours |

Reading the table: honest use is cheap, a few dollars a month per classroom. The in-app budget bounds an ordinary bad day at tens of dollars. It does **not** bound a determined abuser, because the counter lives in memory. The hard monthly cap in each provider console (owner item, hardening plan section e.2) is the only real ceiling; until it is set, the worst-case row is the true exposure. Set it to something like $10 to $20 a month and the worst case becomes "AI stops, Raw Mode continues".

Two cost levers found in the code: stop charging and paying for doomed retries (SRE-02, SRE-04, SRE-13 truncation), and decide the provider order on purpose (SRE-13).

---

## 5. Ranked improvements: making the backend boring

Impact is to a student in a classroom; effort is for one small lane. Top of the list first.

| Rank | Change | Fixes | Impact | Effort |
|---|---|---|---|---|
| 1 | Provider-console spend caps (owner, already listed; repeated because nothing else bounds the bill) | cost | Very high | 15 min, no code |
| 2 | Turn on INFO logging for `app.*`; add `/api/v1/status` with `ai_available` and commit; smoke script checks it | SRE-03 | Very high | S |
| 3 | Classroom profile in `render.yaml` and runbook: per-client in-flight and scene rate; rejected-by-in-flight does not consume rate | SRE-01 | Very high | S |
| 4 | Circuit breaker in `ProviderChain` with a property test | SRE-02, SRE-04 | High | S-M |
| 5 | Ask per-call timeout so two providers fit in 10 s | SRE-08 | High | XS |
| 6 | Warm the backend on Capture and on photo pick; one "waking" retry for scene | SRE-11 | High | S (frontend) |
| 7 | App-level load shedding with CORS and `Retry-After` below the uvicorn limit; `Retry-After` on rate-limit 429; client jitter | SRE-05, SRE-12 | High | S-M |
| 8 | Deploy only after CI passes; CI boots the real start command; graceful-shutdown bound; no-deploy window | SRE-10 | Medium-High | S |
| 9 | Measure Raw Mode on a throttled container; then parallel start or bigger reserve; linear de-dup; hold the slot until the thread ends | SRE-07 | Medium-High | M |
| 10 | Refund budget for non-billable failures | SRE-04 | Medium | S |
| 11 | In-flight acquire and a body deadline in the ASGI guard | SRE-06 | Medium | S |
| 12 | Move validation, semantic and facts work off the event loop; semaphore on `/validate`; smaller Ask body cap | SRE-09 | Medium | S-M |
| 13 | Schema compatibility rule, frozen corpus test, specific 422 message | SRE-14 | Medium (later, large) | S |
| 14 | Cache lookup before the slot; single-flight per image key | SRE-15 | Low-Med | S |
| 15 | Truncation counter and "skip retry on truncation" | SRE-13 | Low-Med | S |
| 16 | Fail start-up on empty production origins; `RENDER` implies production; cache the improve provider; trim `[standard]` extras; reword the disk claim | SRE-15 | Low | XS each |

Per the project's roles these are lane or Kiro tasks, not something this review applied. Items 2, 3, 5 and 6 are the ones I would not go to a classroom without.

---

## 6. What the on-call runbook should say (additions to `docs/SECURITY_RUNBOOK.md`)

**Symptoms to cause, in the order to check.**

| Students report | Most likely cause | Check | Action |
|---|---|---|---|
| "Busy" for a whole class, fine for one phone on mobile data | Per-IP caps (SRE-01) | Render logs: `rate limit hit: path=/api/v1/scene` (WARNING, visible today) | Raise `SCENE_CLIENT_MAX_CONCURRENCY`, `RATE_LIMIT_SCENE_PER_MIN`; tell the teacher to use a share link |
| "Check your connection" from many phones at once | uvicorn concurrency limit (SRE-05) or a deploy in progress | Render events tab; request count | Wait 30 s; do not redeploy |
| Outlines only, no labels, for everyone | No provider key loaded, or global budget spent, or kill switch on | After SRE-03: `/api/v1/status`. Today: response body `reason` is `no_provider` or `budget_exhausted` | Fix the key or raise `PAID_CALLS_PER_DAY`; a restart also resets the count (and the cap is then not a cap) |
| Outlines only for one school | Per-client budget spent | `reason: budget_exhausted` only from that network | Raise `PAID_CALLS_PER_CLIENT_PER_DAY`; resets at 00:00 UTC (05:30 IST) |
| Scenes take 15 s or more, many time out | First provider slow, no breaker (SRE-02) | WARNING lines `Vision provider … failed: request timed out` | Reorder `VISION_PROVIDERS` to put a healthy one first and redeploy; revert later |
| First action after a quiet period fails | Cold start (SRE-11) | Render shows the instance was asleep | Keep-warm ping; open the health URL before class |
| Every API call fails from the site, health is green | CORS origin dropped at start-up, or CSP host mismatch (S5) | ERROR line `Dropped N disallowed origin(s)`; run the smoke script | Fix `ALLOWED_ORIGINS` (https, no trailing slash) |
| 504 with "timed out" when AI is also down | Raw Mode reserve too small for the instance (SRE-07) | WARNING/ERROR around the same second | Lower `PROVIDER_TIMEOUT_SECONDS` so AI gives up earlier; consider a paid instance |

**Standing rules.**
- Before any class or demo: run the smoke script, open the health URL, scan one diagram and ask one question from a phone on the school network.
- No deploys and no environment-variable edits (they restart the process) between 08:00 and 16:00 IST on school days. A restart wipes budget counts, rate limits and the cache.
- The kill switch (`PAID_CALLS_PER_DAY=0`) is safe: the app keeps working in Raw Mode with facts answers.
- Logs must never contain photos, questions, labels or addresses. Today they contain lengths, counts, provider names and timings only; keep it that way when adding lines for SRE-03.
- There is no alerting. Until there is, the free uptime monitor that does the keep-warm ping is also the only pager: have it alert on a failed health check and, after SRE-03, on `ai_available: false`.

**Four measurements nobody has taken yet** (each is an hour, each replaces an assumption in this report):
1. On the deployed site: what a browser receives when the instance is at its concurrency limit, and whether Render's proxy buffers slow uploads (SRE-05, SRE-06).
2. Real p50 and p95 `elapsed_ms` per provider for scene and Ask, from one day of INFO logs (SRE-02, SRE-03).
3. Raw Mode wall time and peak memory for a 1600 px photo and for a 12 MP PNG in a container limited to the instance's CPU and RAM, four requests in parallel (SRE-07).
4. Event-loop time for one maximum-size `/ask` and `/validate` body in the same container (SRE-09).

---

## 7. Checked and found sound (do not re-audit)

- Deadline arithmetic for scene: start time is taken before the queue wait (`main.py:572`), so the 25 s total includes queueing; the AI task is cancelled at its deadline and on client hang-up (`main.py:849-902`).
- Budget ledger: one lock, no await inside, UTC rollover clears both ledgers (`paid_budget.py:101-110, 196-231`); the context variable is set before any task is created (`main.py:604, 936`).
- Cache: stores only validated `mode: "ai"` payloads, deep-copies in and out, bounded and TTL'd, never caches failures (`scene_cache.py:71-94`). Being in-memory, it cannot serve a stale shape across a deploy.
- Middleware order: security headers outside CORS outside the request guard (`main.py:481-499`), so guard rejections carry CORS headers.
- Outbound HTTP: one shared client with bounded connections, closed on shutdown (`_openai_compat.py:80-111`); keys redacted from every error path read.
- hx3 Ask output filter (`ask.py:1041-1052`): canary, delimiters and URLs become the "don't know" answer; the answer is clamped afterwards.
- CI now installs `requirements.lock` on Python 3.11.10 and has schema-drift and Playwright jobs (`.github/workflows/ci.yml:60-125`).

## 8. Notes for the orchestrator

- This task wrote this one file only. No source, config or test was changed, nothing was committed, and no `docs/BUILD_LOG.md` entry was added (single-file rule for this task). Please log it as: tool = Claude Code, "SRE persona review of backend and deploy, read-only".
- Decisions that need the owner: classroom limit profile (SRE-01), provider order (SRE-13), whether a small paid instance is worth it once measurements 3 and 4 are in, and the deploy-after-CI switch (SRE-10).
