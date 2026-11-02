# HANDOFF — Ghost Touch (as of Nov 2, 2026, about 12:00 IST)

Paste this file into a new Claude chat (or keep it in `docs/`) to continue without losing context.
Owner: Ratnesh Singh, student at VIT Bhopal, in Ahmedabad until **Nov 15**. Prefers concise, copy-paste-ready answers.
Facts below were checked in the repo on the date above unless marked *(owner said, not verified)*.

---

## 1. The project
**Ghost Touch**: "Feel diagrams you can't see." Blind and low-vision students explore STEM diagrams on an ordinary Android phone. A photo, screenshot or PDF page of a diagram goes to a vision LLM (Gemini) which returns a normalized JSON `DiagramScene`. The student traces with a finger: **vibrates on lines, "bzzzz-tap" plus the spoken label at corners, a theremin tone tracks graph height**, and they can ask questions by voice or text ("How long is AC?"). If the AI fails, **Raw Mode** (OpenCV edges) still gives something to feel.

**Frankenstein pitch (Kiroween category):** *"We stitched the dumbest part of a phone, its ₹20 notification buzzer, to the smartest thing it can reach, a vision AI. Together they let blind students feel diagrams they can't see."* Theremin (1920s horror instrument) is the supporting third limb. Halloween lives in "the creature", never in blindness. Name is final: **Ghost Touch**.

## 2. Hackathons & deadlines (IST)
| Event | Deadline | Notes |
|---|---|---|
| **STEMergent Hacks 2026** | **Nov 16, 09:00** (submit Nov 14; feature freeze Nov 13) | Hackathon Pathway; disclose AI use (Gemini, Kiro, Antigravity, Claude Code). Draft: `docs/STEMERGENT_SUBMISSION.md` |
| **Kiroween 2026, Frankenstein** | **Dec 5, 03:30** (= Dec 4, 2 pm PT; aim Dec 3) | Bonus targets: Best Student Project, Best Demo, Blog, Social Blitz. Must be built **with Kiro**; `/.kiro` committed; MIT license visible; public GitHub; YouTube video < 3 min; live URL; Kiro write-up |
| Kiro credits request | before Dec 1 | **Submitted Oct 31** *(owner said)* (see §6) |
| CSC Winter Sparkathon | none | **Not eligible** (high-school only). Don't enter |

Same project in both events is allowed (no exclusivity clauses found).

## 3. Repo & tools
- Local: `C:\Users\Ratnesh Singh\Downloads\ghost-touch\ghost-touch` (the **inner** folder, which is the git root; Kiro must open this one).
- GitHub: remote `origin` = `Ratnesh-101/ghost-touch` (public). The remote may still hold older history *(owner said it has `main` and `master`; not verified)*. **Nothing has been pushed from this repo by Claude Code.**
- Stack: React + Vite + TS (PWA, Chrome on Android) · FastAPI + Pydantic v2 · Gemini primary → **OpenAI first fallback** (`gpt-4.1-mini` by default, `OPENAI_MODEL`) → Nebius last fallback (`VISION_PROVIDERS=gemini,openai,nebius`; providers without a key are skipped) · OpenCV Raw Mode · Vitest + fast-check · pytest + Hypothesis · Vercel + Render · `pdfjs-dist` (lazy chunk) for PDF pages.
- Key files: `CLAUDE.md` (Claude Code = planner), `AGENTS.md` (Antigravity = builder rules), `.kiro/steering/{product,tech,structure,review}.md`, `.kiro/specs/ghost-touch/{requirements,design,tasks}.md`, `docs/WIN_PLAN.md` (master plan, overrides CLAUDE.md), `docs/BUILD_LOG.md`, `docs/briefs/` (one brief per task), `docs/handoffs/` (agent reports, `KIRO-PAUSE.md`, session summaries), `docs/reviews/`, `docs/research/` (talkback-spike, competitors, vision-spike, agy-setup), `docs/kiro-evidence/`, `docs/user-test/plan.md`, `docs/DEPLOY.md`, `docs/DEMO_SCRIPT.md`, `research/` (vision spike scripts, 10 synthetic diagrams + ground truth, run outputs), `scripts/` (safe agy launcher), `prototypes/haptics-test.html`. (`prototypes/index.html`, mentioned in WIN_PLAN, is **not in the repo**.)
- Kiro hooks: review on `docs/handoffs/*-report.md` save; tests on `frontend/src/core/*.ts` save; type regen on `schema.py` save. They do not run while Kiro is paused.
- **Tuned haptics (don't change without testing):** line `vibrate(80)` re-triggered every 70 ms; corner `[50, 90, 50]` then 450 ms quiet window; vertex radius 22 px, line 14 px; pitch 200 to 1000 Hz. The proposed **centre tick (25 ms)** is a new pattern awaiting the owner's approval.

## 4. Roles
| Tool | Role |
|---|---|
| Claude Code | Planner, verifier, reviewer (independent reviews by fresh subagents); has also been builder stand-in |
| Antigravity (agy) | Builder (T08, T09, T10a, F1, F2 and the commit runs were done by agy agents) |
| Kiro | Core builder (schema, `frontend/src/core/`, property tests P1 to P13, validator) and reviewer. **Paused, out of credits.** TEMP stubs stand in for its missing modules (register in `docs/handoffs/KIRO-PAUSE.md`) |

## 5. Status
**Built and checked** (tests are on the working tree, see the numbers in "Checks")
- Idea validated; competitor research (Dot Pad, Seeing AI, Desmos Audio Trace, Grafici Accessibili, TouchSight, Raised Lines Foundation, phone-vibration research): the gap is real. TouchSight lessons (teacher vocabulary, validate-then-retry, AI labels + classical CV, never user-tested) are in `docs/research/competitors.md` and the T08 brief.
- Haptics prototype works on OnePlus Nord CE6 (Chrome).
- **Gate A (TalkBack) PASSED:** with TalkBack on, *double-tap-and-hold, then drag* passes touches through and it vibrates. The virtual finger starts at the **centre** and moves relatively, so Explore uses a "relative cursor" (spoken hint, centre tick, re-centre per hold, Android Back exit). Stay on web; native Capacitor is optional Phase 2.
- Kiro: T1, T2 (schema, export, fixtures), T3 (geometry, hit-test, P1 and P8 tests) before credits ran out.
- Built since: T05 drivers + `#/debug`; T06 Start and Capture (photo, image, PDF first page, 3 offline samples); T07 Explore with relative cursor (on a TEMP engine stub); T08 scene pipeline (Gemini + NVIDIA fallback + Raw Mode + validate-then-retry-once, TEMP validator stub); T09 Ask (backend with facts-lookup fallback, frontend voice and text); T10a deploy preparation (`render.yaml`, `frontend/vercel.json`, `.github/workflows/ci.yml`, `docs/DEPLOY.md`, **nothing deployed**); STEMergent draft and demo script (drafts with `[FILL]` markers).
- Independent reviews done: T01-T03, T05, T06 (twice), T06b+T07, T08. Findings were fixed by agents in F1 (frontend) and F2 (backend).
- Vision spike (Gate B proxy, synthetic diagrams only): `gemini-3.8-flash` clean 9/10 usable, simulated photos 7/10 (two were quota failures); **but 29 to 169 s per call** against the 15 s backend budget. `gemini-3.5-flash-lite`: about 2.6 s per call, geometry 0.94 and bars 0.96 but **graphs 0.49 (0 of 5 usable)**. Details and the scorer's three versions: `docs/research/vision-spike.md`.

**Git state**
- **72 commits on local `main`** (real timestamps, nothing backdated). **Not pushed.**
- **Uncommitted:** the F1/F2 fix-agent changes (about 28 modified files and 8 new files: image safety checks, Gemini thinking fallback, history-entry and resize fixes, PDF resolution, `scripts/`, `docs/research/agy-setup.md`, this file, a flash-lite spike run). They pass the tests below but have **not been independently reviewed**, and the T09 (Ask) code has not been independently reviewed either.
- Commit rule used so far: a commit agent with an exact list of paths (no `git add -A`). Tell Claude Code or agy what to commit; neither pushes without an explicit instruction.

**Checks** (run Nov 2; commands from the repo root)
- `npm --prefix frontend exec -- tsc -p frontend --noEmit`: clean. `npm --prefix frontend test`: **212 tests passed** (the known P1 flake may fail about 1 run in 5; rerun). `backend/.venv/Scripts/python -m pytest backend`: **138 passed**; `ruff check backend` and `ruff format --check backend` clean. Research scorer tests: 41 passed.
- Frontend production build (`npm --prefix frontend run build`): OK; 12 precache entries (208 KiB); pdf.js is a separate lazy chunk, excluded from the service-worker cache. Both full frontend runs this morning passed all 212 tests (the P1 flake did not show up).

**Not done / blocked**
- **Phone testing of everything built so far: none done.** Highest priority. Checklist in `docs/handoffs/SESSION-2026-10-31.md` and `docs/briefs/T07-explore.md` (TalkBack on and off, Back gestures, first-`pointerdown` position numbers, PDF, camera, double-reading check).
- **Gemini API key is on the free tier: 20 requests per day per model** (error `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). The credits you see in Antigravity are a separate account and do not apply. Fix: enable billing on the key's Google project, or use a key from a project with billing. Until then every full spike or demo run exhausts a model's day.
- **OpenAI fallback (added Nov 2, uncommitted):** `backend/app/vision/openai_provider.py` + 19 tests (mock HTTP only), wired into the chain, `render.yaml` and `docs/DEPLOY.md`. The key works (it listed 134 models) but **no live vision call has been made** with it, on purpose (see testing rule below). **Two manual edits are still needed in the committed example env file** (Claude Code's guard blocks editing it): set `VISION_PROVIDERS=gemini,openai,nvidia` and add `OPENAI_API_KEY=` and `OPENAI_MODEL=gpt-4.1-mini`.
- **Testing rule (owner, Nov 2):** use the Nebius key (variable NEBIUS_API_KEY in backend/.env; the key was previously stored under the wrong name NVIDIA_API_KEY and must be renamed by the owner) for key checks and bulk test runs, so Gemini and OpenAI quota is only spent on real use.
- **Gate B on real photos:** put 4 to 10 real textbook photos plus 3 digital ones in `research/samples/real/`; ~20 minutes to run once there is quota.
- **Model choice and latency for T08:** decide the default model (fast-lite for geometry/bars, stronger model or a second pass for graphs). `thinking_budget=0` is **rejected by some models** (flash-lite); use a thinking *level* with a fallback (F2 implemented a fallback; real-API behaviour untested).
- **P1 property-test flake (6 of 30 isolated runs):** diagnosed as a **test-generator bug, not a hitTest bug**: two points 1e-45 apart land on the same pixel (letterbox offset swallows the difference), so "return this point" has no unique answer. Test not edited; **Kiro fixes it** when credits return. Evidence and fix suggestions: `docs/kiro-evidence/pbt-p1-flake.md` (+ replay script). Good write-up material: report it honestly as "a property test found a flaw in its own generator".
- Known engine gaps for Kiro (in `docs/reviews/T01-T03-review.md`): bar-edge hits missing in `hitTest.ts`; `Polyline.points` tuple generates `[unknown, unknown]` types; schema range not in the JSON schema.
- Requirement 13 (TalkBack) spec change drafted: `docs/kiro-evidence/spec-change-req13.md` (paste into Kiro).
- Push to GitHub (needs the owner's go-ahead; likely force-push because the remote has older history), set default branch `main`, delete remote `master`.
- BPA email: confirm it was sent (see §7).

**Status update 2026-11-02 (evening)**
- Ask/F1/F2 review fixes committed and pushed.
- main force-pushed to origin.
- PR #1 and #2 open.
- Nebius provider + scene cache + graph equation route written and tested offline (uncommitted until its PR).
- Live graph measurement waiting for the key rename.
- Kiro working through its follow-up prompt.

## 6. Open risks & decisions
1. **"Insufficient use of Kiro" (disqualification risk) is the biggest risk.** Most code is written by agy and Claude Code. When credits return, Kiro must build/own: T3 to T4 core (hit-test fixes, haptic engine, pitch), the validator (8.3), all property tests, the P1 fix, Requirement 13, and review every task via the hook; the TEMP stubs get swapped for its real modules. Keep `BUILD_LOG.md` honest. If Kiro's share stays tiny, the Kiroween entry is weak regardless of quality.
2. **Antigravity permissions (resolved in tooling, one thing left).** Earlier agy launches today (T08, T09, T10a, F1, F2, the commit runs and a stopped spike) used `--dangerously-skip-permissions` with the owner's approval at that time. The owner's rule now: **never again**. Use `scripts/agy-run.sh PROMPT_FILE` (or `scripts\agy-run.ps1 -PromptFile ...`): API-key variables removed for the agy process, model `gemini-3.8-flash-high` + `--effort high`, exact-match allow-list in `scripts/agy-settings.json`, logs in `logs/agy/`. Findings: agy authenticates with the **signed-in account (keyring OAuth)** against Antigravity's backend, **not** with `GEMINI_API_KEY` (the key variables are not set anywhere; the 429s came from Claude Code's own direct API calls). Your stored grants in `~/.gemini/config/config.json` include `git push`, `git commit`, `gh pr merge`, `gh pr create`; they are **not applied** when the launcher is used, but you may want to remove them. `research/vision_spike.py --provider agy` now also uses the exact-match settings and removes the key variables (no dangerous flag). **For the commit run on Nov 2 the owner explicitly re-approved `--dangerously-skip-permissions` for that one job** (commit only; no push, no `gh`). Full write-up: `docs/research/agy-setup.md`.
3. **The launcher's allow-list has no git add/commit.** To have agy commit, create a one-off settings file listing the exact `git add -- <paths>` and `git commit -F <message file> -o -- <paths>` commands (exact text only; no wildcards), or ask Claude Code to commit with temporary git permission.
4. **Kiro credits:** form submitted with **two accounts** *(owner said)*. If both are Ratnesh's own, contact the Kiroween Hackathon Manager to keep only one (duplicates may get both rejected). Expected about Nov 4. **Decision date Nov 5:** if no credits, discuss moving core tasks to agy (draft in `docs/handoffs/KIRO-PAUSE.md`); do not move them silently.
5. **Gemini free tier:** cache validated scenes by image hash (never failures), NVIDIA fallback (not yet run against real calls), offline samples, billing before the demo.
6. **CI will go red about 1 time in 5** because of the Kiro-owned P1 flake; the workflow retries `npm test` once and says why. Remove the retry when P1 is fixed.
7. Never backdate commits (must prove work after Oct 30). Fill the heatmap by committing daily.
8. Secrets only in `backend/.env` (git-ignored). Never paste keys into chat.

## 7. School session (Blind People's Association, Ahmedabad)
- Org: Blind People's Association, Vastrapur, Ahmedabad. **Contact details (phone, mobile, staff names, emails) are deliberately not stored in this file**: it is meant to be committed to a public repo, and `docs/WIN_PLAN.md` says not to keep phone numbers in the repo. Keep them in your own notes. *(They were in an earlier version of this file; that version was never committed.)*
- Ask: in person, about 20 min, 2 to 4 students + a teacher, **Nov 7 to 14**. Attach the 30-second prototype video. Call first, then email.
- Consent before any recording (guardian if under 18); hands-and-phone shots only.
- Tasks and readout rules: `docs/user-test/plan.md` (corners, right angle, sine peaks, tallest bar, one voice question). Record numbers and quotes in `docs/user-test/results.md`. TouchSight was never tested with blind users, so a real session is a differentiator.
- Fallback: VIT Bhopal disability cell after Nov 15; online follow-up.

## 8. Next steps (in order)
1. **Decide how to commit the uncommitted work** (see §6.3), after a quick independent review of the Ask (T09) and F1/F2 changes if you want it. Then, only when you say so, **push**: `git push --force-with-lease -u origin main`, then `git push origin --delete master` (set the default branch to `main` first).
2. **Phone test** everything (TalkBack on and off) using the checklists above. Report the first-`pointerdown` offset numbers.
3. Send/confirm the BPA email; call.
4. Enable billing on the Gemini key's project (or get a billed key), then rerun the spike: 3.8-flash with a thinking level, 3.5-flash on graphs, NVIDIA; add real photos. Decide the default model and the graph strategy.
5. Deploy (`docs/DEPLOY.md`: Render then Vercel, set `ALLOWED_ORIGINS` and `VITE_API_URL`), then test the live URL on the phone with and without TalkBack. Feature freeze **Nov 13**, submit STEMergent **Nov 14**: fill the `[FILL]` markers in `docs/STEMERGENT_SUBMISSION.md` only with real facts.
6. When Kiro credits arrive: apply Req 13, fix P1, build the remaining core + property tests, swap TEMP stubs, turn reviews back to Kiro.
7. Collect Kiro evidence as you go (`docs/kiro-evidence/`): spec screenshots, hooks firing, the PBT finding, MCP use, tool comparison.

## 9. Ready-to-use prompts
**Resume Claude Code:**
```
Read docs/handoff.md, docs/WIN_PLAN.md and the latest docs/handoffs/SESSION-*.md. Never use --dangerously-skip-permissions; launch agy only through scripts/agy-run.sh. Then tell me the current state and the next 3 actions.
```
**Launch an agy task safely (Git Bash):**
```
scripts/agy-run.sh path/to/prompt.txt my-run-name
```
**When Kiro credits return (in Kiro chat):**
```
Read #tech.md and #review. Apply docs/kiro-evidence/spec-change-req13.md to the spec, then fix the P1 flake described in docs/kiro-evidence/pbt-p1-flake.md (make the generator produce points that are distinct after projection), then replace the TEMP stubs listed in docs/handoffs/KIRO-PAUSE.md with real core modules and continue with the remaining Kiro-owned tasks in tasks.md.
```
