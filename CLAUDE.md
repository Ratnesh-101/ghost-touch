# CLAUDE.md — Ghost Touch handoff

You are picking up a hackathon project that is fully planned but not yet coded. This file is the single source of truth for how it gets built. Read it fully before doing anything.

## ⚠️ Your role: reviewer and helper, NOT the main builder
This project is entered in **Kiroween 2026**, which requires the app to be built with **Kiro** and can disqualify projects for "insufficient use of Kiro." So:

- **Kiro builds.** The user runs the spec tasks in `.kiro/specs/ghost-touch/tasks.md` with Kiro's agent (IDE or Kiro CLI). Kiro writes the feature code and the property tests.
- **You (Claude Code) help.** Your jobs:
  1. **Review** code Kiro wrote against this file, the steering docs, and the spec. Report concrete problems (file, line, why, fix) — prioritized, concise.
  2. **Debug** when the user is stuck: diagnose, explain, and propose a minimal fix. Apply a fix only if the user asks, and keep it small.
  3. **Write prompts for Kiro** when the user asks ("give me the Kiro prompt for Task 7") — specific, referencing requirement numbers and files.
  4. **Docs and presentation:** demo script, STEMergent description, Kiro write-up, blog, social post drafts.
  5. **Verify:** run tests, the dev server, lint, and the device checklist; report results.
- **Do not implement whole spec tasks yourself**, even if asked casually. If the user explicitly insists, remind them once of the disqualification risk, then follow their decision.
- **Do not tick checkboxes in `tasks.md`** for work Kiro did — Kiro updates those itself.
- **Log every meaningful thing you do** in `docs/BUILD_LOG.md` with tool = "Claude Code" (review, fix, doc). Honest logs make an honest write-up; the rules ask how different tools compared.

Section 6 below is the build plan. Use it as **the checklist you review Kiro's work against**, and as the source for prompts you write for Kiro.

---

## 0. Read first (in this order)
1. This file.
2. `.kiro/steering/product.md` — what we're building and the principles.
3. `.kiro/steering/tech.md` — stack, architecture rules, **tuned haptic values**.
4. `.kiro/steering/structure.md` — folder layout.
5. `.kiro/specs/ghost-touch/requirements.md`, `design.md`, `tasks.md` — the spec. Task numbers below refer to `tasks.md`.
6. `prototypes/haptics-test.html` — the working haptics spike. Its touch logic is the reference behavior for the haptic engine.

If anything in this file conflicts with the spec, **the spec wins** — then tell the user about the conflict.

---

## 1. Project in one paragraph
**Ghost Touch** lets blind and low-vision students feel STEM diagrams on an ordinary Android phone. The user photographs a textbook diagram. A vision LLM turns it into a normalized JSON `DiagramScene`. The student drags a finger over the screen: the phone **vibrates on lines**, gives a **"bzzzz-tap" at corners** and speaks the label, and plays a **theremin tone** that rises with a graph's height. They can **ask questions by voice** ("How long is AC?"). If the AI fails, **Raw Mode** vibrates on raw image edges so the app never leaves the user with nothing.

Frankenstein pitch: *a notification buzzer (nerves) + a vision LLM (eyes) + a synthesizer (voice) stitched into one creature.*

---

## 2. Deadlines (IST)
| Milestone | Date | Scope |
|---|---|---|
| **STEMergent submission** | **Nov 16, 9:00 am** (aim for Nov 15) | Tasks 1–10 (MVP) |
| Kiro credits request | before Dec 1 | user does this |
| **Kiroween submission** | **Dec 5, 3:30 am** | Tasks 11–16 (polish) |

The user is a student with exams. Prefer a working, demoable vertical slice over completeness. Never leave `main` in a broken state.

---

## 3. Non-negotiable rules
1. **Git:** never commit, push, create branches, or open PRs unless the user explicitly says so in that message. Leave changes in the working tree and summarize them.
2. **Never touch `/.kiro` in `.gitignore`.** It must be committed for Kiroween (disqualification risk).
3. **Kiro stays the primary builder** (see "Your role" at the top). Log your own work in `docs/BUILD_LOG.md`; never claim Kiro's work or vice versa.
4. **Pure core:** files in `frontend/src/core/` must not import React or touch `window`, `navigator`, `document`, audio, or speech. Browser APIs live only in `frontend/src/drivers/`.
5. **Do not change the tuned haptic values** (`tech.md` table) without the user's approval. They were tested by hand on the user's phone.
6. **Accessibility is the product.** Every new screen must be usable eyes-closed: spoken state changes, accessible names, 48×48 px targets.
7. **No secrets in code.** API keys only via env vars; add `.env.example`, never `.env`.
8. **Ask before** adding a paid service, changing the stack, or deleting files.

---

## 4. Decisions already made (don't relitigate)
| Decision | Choice | Why |
|---|---|---|
| Runtime | Web PWA, Chrome on Android | Vibration confirmed working on the user's OnePlus Nord CE6 |
| Native fallback | Capacitor + `@capacitor/haptics`, only if budget-phone test fails (Task 15) | Keep haptics behind `HapticDriver` |
| Frontend | React 18 + Vite + TypeScript strict | User's existing stack |
| Backend | FastAPI + Pydantic v2, Python 3.11 | User's existing stack |
| Vision LLM | Google Gemini (Flash-class vision model) via `google-genai`, behind `VisionProvider` | Free tier suits a student; swappable |
| Edge detection | `opencv-python-headless` | Raw Mode |
| Tests | Vitest + fast-check; pytest + Hypothesis | Property-based testing is a Kiroween judging point |
| Deploy | Vercel (frontend), Render (backend) | User already uses both |
| Theme | Dark, glowing green `#39ff88` strokes, theremin; Halloween lives in the "creature," never in blindness | See `product.md` |

---

## 5. Environment & commands

### Layout to create (Task 1)
```
frontend/   React + Vite + TS
backend/    FastAPI
docs/       BUILD_LOG.md, DEMO_SCRIPT.md, KIRO_WRITEUP.md
```

### Frontend
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm i
npm i -D vitest fast-check @vitest/coverage-v8 vite-plugin-pwa json-schema-to-typescript
npm run dev        # dev server
npm test           # vitest run
```
Add scripts: `"test": "vitest run"`, `"test:prop": "vitest run --dir tests -t prop"`, `"gen:types": "json2ts -i ../backend/scene.schema.json -o src/types/scene.gen.ts"`.

To test on the phone during development: `npm run dev -- --host` and open over HTTPS (use `vite-plugin-mkcert` or a Cloudflare/ngrok tunnel). **Vibration and camera need HTTPS** on the phone.

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pydantic python-multipart google-genai opencv-python-headless numpy pytest hypothesis httpx ruff
uvicorn app.main:app --reload --port 8000
pytest
python -m app.export_schema      # writes backend/scene.schema.json
```
`.env.example`:
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_ORIGINS=http://localhost:5173
SCENE_TIMEOUT_SECONDS=15
```

### Type generation flow
`schema.py` → `python -m app.export_schema` → `backend/scene.schema.json` → `npm run gen:types` → `frontend/src/types/scene.gen.ts`. Never hand-edit the generated file.

---

## 6. Build plan (MVP, Tasks 1–10)

Kiro executes these in order. Each step lists a **Definition of Done (DoD)** — when the user asks you to review a task, check Kiro's work against its DoD and the rules in §3.

### Task 1 — Scaffold
- Create folders per `structure.md`, MIT `LICENSE` already exists, PWA manifest (name "Ghost Touch", theme `#0b0b10`).
- Create `docs/BUILD_LOG.md` with a header.
- **DoD:** `npm test` and `pytest` both run (even with zero tests); `uvicorn` serves `/api/v1/health` → `{"ok": true}`.

### Task 2 — Schema + fixtures
- Implement models exactly as in `design.md` → Data Models.
- `app/export_schema.py` dumps `DiagramScene.model_json_schema()`.
- Fixtures in `backend/fixtures/` **and** copied to `frontend/public/samples/`:
  - `triangle.json` — right triangle A, B, C, labels, facts like `"AB = 3 cm"`, `"BC = 4 cm"`, `"angle B = 90°"`.
  - `sine.json` — `function_graph`, one polyline of ~100 points for `y = sin(x)` over one period, axes set.
  - `bars.json` — `bar_chart`, 4 bars with labels and values.
- **DoD:** fixtures validate against the Pydantic model in a test.

### Task 3 — Geometry + hit-testing (pure)
- `Viewport = { width, height, offsetX, offsetY, scale }`, letterboxed to preserve aspect ratio (scene is a unit square unless `aspect` is added later).
- `hitTest` priority: **vertex > line (segment, polyline, axis, bar edges) > bar interior > none**. Radii from config: vertex 22 px, line 14 px.
- **DoD:** P1, P2, P8 pass with ≥200 runs each.

### Task 4 — Haptic engine (pure state machine) — most important
Port the logic from `prototypes/haptics-test.html` (`handle()` function) into `step()`. Reference implementation shape:

```ts
export interface HapticConfig {
  lineMs: number; retriggerMs: number; cornerPattern: number[]; quietMs: number;
}
export const DEFAULT_HAPTICS: HapticConfig = {
  lineMs: 80, retriggerMs: 70, cornerPattern: [50, 90, 50], quietMs: 450,
};
export interface EngineState {
  lastVertexId: string | null; onLine: boolean; lastBuzz: number; quietUntil: number;
  lastBarId: string | null;
}
export const initialState = (): EngineState => ({
  lastVertexId: null, onLine: false, lastBuzz: -Infinity, quietUntil: -Infinity, lastBarId: null,
});

export function step(s: EngineState, input: Input, cfg = DEFAULT_HAPTICS):
  { state: EngineState; effects: Effect[] } {
  // lift: vibrate(0), tone(null), reset
  // vertex: if new -> vibrate(cornerPattern), speak(label ?? `Point ${id}`), tone(null), quietUntil = t + quietMs
  //         if same -> no effects; always set onLine=false
  // line:   if t >= quietUntil && t - lastBuzz > retriggerMs -> vibrate(lineMs), lastBuzz = t
  //         if curve (polyline in function_graph) -> tone(pitchForY(yNorm)) else tone(null)
  // bar interior: if new bar -> speak(`${label}, ${value}`); tone(pitchForValue(value, max))
  // none:   if onLine && t >= quietUntil -> vibrate(0); tone(null); onLine=false
}
```
- `pitchForY(y) = 1000 - y * 800` clamped to [200, 1000] (y=0 is top).
- **DoD:** P3, P4, P5, P6, P7 pass. Also a unit test replaying a scripted trace of the triangle produces: line buzzes → corner → silence ≥450 ms → line buzzes.

### Task 5 — Drivers
- `WebHapticDriver.vibrate(p)` → `navigator.vibrate(p)`; expose `supported` and last return value for a debug overlay.
- `AudioDriver`: one oscillator created on unlock; `setTargetAtTime` for frequency (0.02) and gain (0.15 on, fade 0.03 off). Copy from prototype.
- `SpeechDriver.speak` cancels previous utterance; `listen()` wraps `webkitSpeechRecognition` with a 6 s timeout.
- A `runEffects(effects, drivers)` function in `drivers/index.ts`.
- **DoD:** a hidden `/debug` route shows support status and has buttons to fire each pattern (port the prototype buttons).

### Task 6 — Start + Capture screens
- Start: full-screen button, speaks intro on load (note: Chrome may block speech before a gesture — speak the intro again right after the tap if it didn't play).
- Capture: big "Take photo" (`<input type=file accept="image/*" capture="environment">`), "Choose image", and three sample buttons. Downscale to 1600 px longest side with a canvas before upload.
- While waiting: speak "Reading your diagram" and pulse a soft tone every 1.5 s.
- **DoD:** selecting a sample loads Explore with no network.

### Task 7 — Explore screen
- Canvas renders scene in glowing green on black (copy prototype drawing style).
- Pointer events with `setPointerCapture`; `touch-action: none`; every `pointermove` → `hitTest` → `step` → `runEffects`.
- Axis crossings: track side of each axis in state (can live in the screen, not the engine) and speak once per crossing.
- Two-finger swipe down → back to Capture (announce this on entry).
- **DoD:** user can trace all three samples on the phone eyes-closed and the behavior matches the prototype. Ask the user to run the manual checklist in `design.md` → Testing Strategy.

### Task 8 — Backend scene pipeline
- `POST /api/v1/scene` (multipart `image`). Flow: provider.extract → `validate.py` → if invalid, retry once with the validation errors appended to the prompt → if still invalid or timeout or exception → `raw_mode.py`. Return `{scene, mode, reason?}`.
- Extraction prompt (put in `vision/prompts.py`):
  ```
  You convert images of school STEM diagrams into JSON for a touch-and-vibration app used by blind students.
  Return ONLY JSON matching this schema: {schema}
  Rules:
  - Coordinates are normalized to [0,1], origin top-left, relative to the diagram's bounding box.
  - kind: geometry | function_graph | bar_chart | unknown.
  - geometry: every labeled corner is a point; every drawn edge is a segment between point ids.
  - function_graph: sample each curve as a polyline of 40-150 points; set axes.
  - bar_chart: one bar per bar with label and numeric value.
  - Put every given measurement or relation from the image into "facts" as short sentences.
  - Do not invent labels or values that are not visible. If unsure, use kind "unknown".
  ```
  Use the model's JSON / structured output mode if available.
- `validate.py` repair rules: clamp coordinates within ±0.02 of [0,1]; reject beyond that; drop segments referencing missing points; dedupe ids by suffixing; reject a scene with zero drawable elements.
- `raw_mode.py`: grayscale → GaussianBlur(5) → Canny(50,150) → findContours → `approxPolyDP(epsilon = 0.01 * perimeter)` → segments, keep the longest until ≤300, normalize.
- **DoD:** P9, P10 pass; a real photo of a textbook triangle returns `mode: "ai"`; a photo of random clutter returns `mode: "raw"` without crashing.

### Task 9 — Ask
- `POST /api/v1/ask {scene, question, lang}`. Prompt: answer in ≤2 short sentences using only scene JSON and facts; say exactly "I don't know from this diagram." otherwise; reply in `lang`.
- Frontend: two-finger long-press (600 ms) or the Ask button → listening tone → `listen()` → POST → `speak(answer)`. Text box fallback.
- **DoD:** "What is the length of AB?" on `triangle.json` answers "3 centimetres"; "What colour is it?" answers "I don't know from this diagram."

### Task 10 — Deploy + STEMergent
- Render: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env vars set. Vercel: `VITE_API_URL`.
- Draft `docs/STEMERGENT_SUBMISSION.md`: problem, who it helps, STEM connection, how it works, AI tools used (disclose Gemini, Kiro, Claude Code), what's next.
- Draft `docs/DEMO_SCRIPT.md` (see §8).
- **DoD:** deployed URL works on the user's phone end to end. User submits; you don't.

---

## 7. Polish plan (Kiroween, Tasks 11–16)
Follow `tasks.md`. Priorities if time is short: **14 (accessibility + theme) → 16 (submission) → 11 (teacher correction) → 12 (Hindi) → 13 (offline) → 15 (Capacitor only if needed).**

For Task 16 write `docs/KIRO_WRITEUP.md` covering, honestly: specs (how requirements → design → tasks drove the build), steering docs (tuned haptic values, pure-core rule), hooks (property tests on save in `core/`, type regeneration on `schema.py` save), property-based testing (list P1–P11 and **any real bug a property caught** — keep notes in `BUILD_LOG.md` when that happens), and how Kiro and Claude Code were each used.

---

## 8. Demo script outline (≤3 minutes)
1. **0:00–0:20 Problem.** Diagrams lock blind students out of STEM; tactile graphics are slow and costly; most already own an Android phone.
2. **0:20–0:40 The creature.** Buzzer = nerves, vision AI = eyes, synthesizer = voice.
3. **0:40–1:40 Live.** Photograph a textbook triangle → blindfolded volunteer traces it → says "right triangle, corner B" → asks "How long is AC?" → answer spoken.
4. **1:40–2:10 Graph.** Trace a sine curve; theremin rises and falls; volunteer counts the peaks.
5. **2:10–2:30 Never fails.** Messy photo → Raw Mode still gives outlines.
6. **2:30–3:00 Impact + Kiro.** Real student feedback if available; specs, steering, hooks, and property tests shown on screen.

---

## 9. Known risks & mitigations
| Risk | Mitigation |
|---|---|
| Vision LLM coordinates are imprecise | Validation + Raw Mode now; teacher correction in Task 11 |
| Budget phones have weaker motors | Task 15 test; Capacitor driver if needed |
| Speech before user gesture is blocked | Repeat intro after the start tap |
| iOS has no web vibration | Out of scope; state "Android" in the pitch |
| Free-tier rate limits during demo | Cache scene results by image hash; samples work offline |
| Kiro usage judged insufficient | §3 rule 3: tasks.md ticks + BUILD_LOG |

---

## 10. How to report back to the user
The user prefers **concise, copy-paste-ready** output.

**For a review:** verdict in one line (ship / fix first), then issues as `severity · file:line · problem · fix`, highest severity first. Say plainly if Kiro's code is good.

**For a debug:** cause in one line, the fix, and how to confirm it worked.

**For a Kiro prompt:** one copy-paste block the user can paste straight into Kiro chat.

Always end with what to test on the phone (if relevant) and anything that needs the user's decision.

Do not paste large diffs into chat; summarize changed files.
