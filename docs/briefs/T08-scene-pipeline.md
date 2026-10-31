# T08 — Backend scene pipeline (Gemini primary, NVIDIA fallback)

Builder: Antigravity | Reviewer: Claude Code (Kiro paused) | Planner: Claude Code
Spec: `.kiro/specs/ghost-touch/tasks.md` Task 8 | Requirements: 3.1–3.5, 8.1–8.3
Depends on: T2 (`schema.py`, fixtures), and Kiro's `validate.py` (see "Split of work"). Kiro is paused and `validate_scene` is still a docstring stub, so do not wait: follow `AGENTS.md` rule 3. Create `backend/app/_temp/validate_stub.py` (first line `# TEMP-STUB: replaced by app/validate.py (Task 8.3, Kiro). Do not extend.`) with the contract below: parse the JSON if given a string, run `DiagramScene.model_validate`, and return `ValidationResult(scene, errors)` using the exception messages. **No repair rules and no vocabulary check in the stub**, since those are Kiro's 8.3. Import `validate_scene` in exactly one place (the pipeline module) and inject the validator into the route with `Depends`, so tests can supply a fake. Register the stub in `docs/handoffs/KIRO-PAUSE.md`. Pipeline tests that need the vocabulary rule ("blue polygon") use a fake validator that rejects it; they do not depend on the stub.

## Read first
1. `CLAUDE.md` §6 Task 8 (flow, extraction prompt text, raw-mode parameters). The prompt text there is the one to use.
2. `.kiro/steering/tech.md` architecture rule 5: never pass unvalidated LLM output to the frontend.
3. `backend/app/schema.py`, `backend/app/vision/base.py`, `backend/app/main.py`.

## Split of work (matters for the Kiro review and the Kiroween write-up)
| Item | Owner |
|---|---|
| 8.1 `VisionProvider` + `GeminiProvider` + **`NvidiaProvider`** + fallback chain | Antigravity (this brief) |
| 8.2 `vision/prompts.py` | Antigravity |
| 8.3 `validate.py` repair rules | **Kiro** (do not edit) |
| 8.4 `raw_mode.py` | Antigravity |
| 8.5 `POST /api/v1/scene` | Antigravity |
| 8.6 P9 validator property tests, 8.7 P10 Raw Mode bound | **Kiro** (do not write) |

Kiro's contract you code against (ask Kiro to adjust it via "Needs from Kiro" if it doesn't fit):
```python
# app/validate.py
class ValidationResult(NamedTuple):
    scene: DiagramScene | None
    errors: list[str]          # empty iff scene is not None
def validate_scene(raw: str | dict) -> ValidationResult: ...   # never raises, even on garbage
```

## Providers (8.1)

```python
# app/vision/base.py
class VisionError(Exception):          # provider-level failure: HTTP error, 429, 5xx, timeout, empty body
    def __init__(self, provider: str, reason: str): ...

class VisionProvider(Protocol):
    name: str
    async def extract(self, image: bytes, mime: str, prompt: str, *, timeout: float) -> str: ...
    # returns the model's raw text (expected JSON). Raises VisionError. Never returns unvalidated data as a DiagramScene.
```

### GeminiProvider (primary) — `vision/gemini.py`
- `google-genai` SDK. Key `GEMINI_API_KEY`, model `GEMINI_MODEL` (default `gemini-3.8-flash`).
- Use structured output / JSON response mode with `response_mime_type="application/json"`. Passing the DiagramScene JSON schema is optional; if the SDK rejects it, fall back to JSON mode without schema.
- Wrap all SDK exceptions in `VisionError("gemini", ...)`.

### NvidiaProvider (fallback) — `vision/nvidia.py`
- NVIDIA's hosted API is OpenAI-compatible. Call `POST {NVIDIA_BASE_URL}/chat/completions` with `httpx.AsyncClient` (no new SDK).
- Env: `NVIDIA_API_KEY` (already in the user's `.env`, **never read, print or log its value**), `NVIDIA_MODEL`, `NVIDIA_BASE_URL` (default `https://integrate.api.nvidia.com/v1`).
- **Do not hardcode a model name as the only option.** Pick a current vision-capable model from build.nvidia.com, set it as the default of `NVIDIA_MODEL` in `.env.example`, and state in the report which one you chose and why. Prefer a model that follows JSON instructions well; confirm by running the three sample diagrams' images through it.
- Request: one user message with a text part (the prompt) and an `image_url` part (`data:<mime>;base64,...`), `temperature=0`, `max_tokens` large enough for ~150 polyline points (start at 4096), `stream=false`. Ask for JSON in the prompt; use `response_format={"type":"json_object"}` only if the chosen model accepts it.
- **Image size limit:** NVIDIA's hosted vision endpoints have historically capped inline base64 images at roughly 180 KB. Verify this for the chosen model. If it applies, downscale and re-encode with OpenCV (longest side 1024 px, JPEG quality stepping down) until the payload fits, and **only for NVIDIA**. Gemini gets the original upload. Put this in a pure helper `fit_image_for_inline(image, max_bytes) -> bytes` with a unit test.
- Strip markdown fences (```` ```json ````) from the reply before returning, since non-Gemini models often add them.
- Map 429, 5xx, timeouts, connection errors and empty `choices` to `VisionError("nvidia", ...)`. Redact the `Authorization` header from any log or error text.

### Fallback chain — `vision/chain.py`
```python
class ProviderChain:
    def __init__(self, providers: Sequence[VisionProvider]): ...
    async def extract(...) -> tuple[str, str]:   # (raw_text, provider_name_used)
```
- Order from env `VISION_PROVIDERS` (default `gemini,nvidia`). A provider whose key is missing is **skipped silently at startup** (log one line `vision providers: gemini, nvidia` listing names only). Zero providers configured → the pipeline goes straight to Raw Mode with reason `no_provider`.
- **A fallback happens on `VisionError` only** (provider outage, rate limit, timeout, empty reply). Try the next provider.
- **Invalid scene content is not a provider failure.** Validation flow below handles it.
- Factory `build_chain_from_env() -> ProviderChain` lives in `vision/__init__.py`; the route depends on it via FastAPI `Depends` so tests can override it.

## Pipeline (8.5) — `POST /api/v1/scene`, multipart field `image`

```
read upload (≤10 MB, JPEG/PNG/WebP, else 413/415 with a clear message)
deadline = 15 s total (asyncio.timeout) — Requirement 3.4
per-provider call cap = 8 s, so the second provider still has time
1. raw, used = chain.extract(image, EXTRACTION_PROMPT)
2. result = validate_scene(raw)
3. if invalid: ONE retry — same chain, prompt + "\nYour previous JSON was invalid:\n<errors>\nReturn corrected JSON only."
4. still invalid, or all providers raised VisionError, or deadline hit, or any other exception
   -> raw_mode.build_raw_scene(image) with reason in {"invalid", "provider_error", "timeout", "no_provider", "error"}
5. return {scene, mode: "ai"|"raw", reason?}
```
- Validated scenes only ever leave this route. Raw Mode scenes are built by our own code but must also pass through `validate_scene` before returning (cheap, and keeps rule 5 unconditional).
- The retry (step 3) stays on the provider that answered; do not spend the budget re-running the chain. If the remaining deadline is under ~3 s, skip the retry and go to Raw Mode.
- Do not change the response contract. Expose the provider used as a response header `X-Vision-Provider: gemini|nvidia|none` and in server logs (names only). It is not part of the scene JSON.
- Never let an exception escape as a 500 for a valid upload. Raw Mode is the floor (Req 8).
- Log: provider used, mode, reason, elapsed ms. No image bytes, no keys, no full model replies.
- `ALLOWED_ORIGINS` CORS from env, no wildcard.

## Prompt (8.2) — `vision/prompts.py`
Use the prompt text in `CLAUDE.md` §6 Task 8 verbatim, with `{schema}` filled from `DiagramScene.model_json_schema()`, **plus the vocabulary block below appended to its rules**. Provide `build_prompt(errors: list[str] | None = None) -> str`. Both providers get the same prompt.

### Teacher vocabulary block (source: `docs/research/competitors.md`, TouchSight lessons)
A blind student hears every label, so labels must sound like a teacher's, not like a description of pixels. Append to the rules:
```
- Label things the way a maths or science teacher would say them aloud, using standard terms:
  "hypotenuse", "vertex B", "right angle at B", "x-axis", "radius", "parallel to AB".
  Prefer the label printed in the diagram (A, B, C, "AB", "h") and add the role when it is clear
  ("hypotenuse AC").
- Never label an element by its appearance. Colours, line styles and generic shape words are not
  labels: not "blue polygon", "red line", "dotted shape", "green circle thing".
- If an element has no printed label and no standard name, leave its label empty. An empty label is better than an appearance label.
- Put standard names in labels and facts in plain words ("angle B = 90°"), never as visual descriptions.
```
Include a one-line good/bad example pair in the prompt itself ("hypotenuse AC" vs "long blue line"). On the validation retry, `build_prompt(errors)` also appends: "Use the vocabulary a teacher would use; remove colour and shape descriptions from labels."

### Why these two rules exist: lessons from TouchSight (`docs/research/competitors.md`)
TouchSight (a hackathon project that turns diagram photos into tactile sheets) found that Gemini's first labels were useless ("Upper left section", "Faceted heart shield") until the prompt named the audience and asked for teacher-style terms, and that **validating the output and retrying once mattered as much as the prompt**: "checking the AI's output matters as much as the prompt". It also found that **AI labels combined with classical computer vision** worked best (edge detection alone failed on shaded drawings), that failed responses must **never be cached**, and that a quota error or a busy model should fall through to the next model. It was never tested with blind users. What this means for this task:
- The vocabulary block and the one validation retry are not optional polish; test both (the pipeline tests below).
- **Do not cache failed or Raw Mode responses.** If you add the image-hash cache from `CLAUDE.md` §9, cache only validated `mode: "ai"` scenes.
- Fall through the provider chain on quota (429), "high demand" (503) and timeouts; our own spike hit a 503 from Gemini on 2026-11-01, so the NVIDIA fallback is a real need. A short wait and one retry on the same provider before falling through is acceptable if the 15 s budget allows.
- Keep AI for meaning and labels and OpenCV for Raw Mode and boundaries; do not ask the model to be the only source of geometry.
- **Model name:** Google retired `gemini-2.5-flash` for new users (the API now answers 404 and points to `gemini-3.8-flash`). Use `GEMINI_MODEL` from the environment, default `gemini-3.8-flash`, and never hard-code a model id.

## Vocabulary check (Kiro owns the code, in `validate.py`)
Added to Kiro's contract, agy codes against it but does not write it:
- `validate_scene` returns an error (so `scene is None`) when any **point, segment or polyline** label consists *only* of colour or generic-shape/appearance words (e.g. "blue polygon", "red line", "dotted shape", "green circle"). Labels with any real term pass ("hypotenuse", "vertex B", "Point B", "A", "AB", "right angle at B"). Empty or missing labels pass.
- Bar labels and `title` are not checked, because a chart legitimately has a bar called "Red" (flag in review if this needs revisiting).
- The error text names the element id and the offending label, for example `segment s3: label "blue polygon" describes appearance, not a teacher term`. These strings are what agy's pipeline appends to the retry prompt (existing step 3). No new retry path: it is the same single retry, then Raw Mode with reason `invalid`.
- The word list is data in `validate.py`, so Kiro can tune it; agy must not duplicate it in the pipeline or prompt code.
- Pipeline tests agy writes: a `FakeProvider` first returns a scene containing "blue polygon", then a clean one → `mode: "ai"` and the retry prompt contains the vocabulary error text; returns "blue polygon" twice → `mode: "raw"`, reason `invalid`.

## Raw Mode (8.4) — `raw_mode.py`
`build_raw_scene(image: bytes) -> DiagramScene`: grayscale → `GaussianBlur(5)` → `Canny(50,150)` → `findContours` → `approxPolyDP(epsilon = 0.01 * perimeter)` → segments; keep the longest until ≤300; normalise to [0,1] by image width/height; `kind="unknown"`, unique ids, every segment endpoint refers to an existing point. Undecodable bytes → return an empty-but-valid fallback only if `validate_scene` allows; otherwise raise a typed error the route maps to HTTP 422 with a spoken-friendly message. Kiro writes P10 against this.

## Config and secrets
- Add to `backend/.env.example` (keys empty, never real values): `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-3.8-flash`, `NVIDIA_API_KEY=`, `NVIDIA_MODEL=<your chosen default>`, `NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1`, `VISION_PROVIDERS=gemini,nvidia`, `ALLOWED_ORIGINS=http://localhost:5173`, `SCENE_TIMEOUT_SECONDS=15`.
- Read config with `os.environ` only. Run locally with `uvicorn app.main:app --reload --env-file .env`, so no `python-dotenv` dependency is needed.
- **Do not open, print or copy `.env`.** Confirm `.env` is in `.gitignore`.
- The only dependency change allowed: move `httpx` from the `dev` extra to `dependencies` in `pyproject.toml`. Anything else needs the user's approval.

## Tests you write (no network, no real keys)
- `FakeProvider` (returns canned text / raises `VisionError`) drives all pipeline tests via `dependency_overrides`; clear overrides after each test.
- Chain: first provider ok → second never called; first raises `VisionError` → second used and header says `nvidia`; both raise → Raw Mode with `provider_error`; missing key → provider skipped; zero providers → `no_provider`.
- Pipeline: valid JSON → `mode: "ai"`; invalid then valid on retry → `ai`, prompt on the retry contains the error text; invalid twice → `raw`, `invalid`; provider sleeps past the deadline (use a short test timeout) → `raw`, `timeout`; garbage non-JSON → `raw` without a 500; fenced ```json reply is accepted.
- `NvidiaProvider` against `httpx.MockTransport`: request has the image part and a Bearer header, 429 → `VisionError`, empty `choices` → `VisionError`, fenced reply is unwrapped, key never appears in the raised error text.
- `fit_image_for_inline`: output ≤ limit, still decodes, small input returned unchanged.
- Upload validation: wrong type 415, oversized 413.

## Definition of Done
- [ ] `cd backend && pytest` passes; `ruff check .` and `ruff format --check .` clean.
- [ ] Type hints on every function; no `print()` (use `logging`); no secrets anywhere in tracked files (`git grep -n "nvapi-\|AIza"` returns nothing).
- [ ] With only `GEMINI_API_KEY` set, a real textbook triangle photo returns `mode: "ai"` and header `gemini`.
- [ ] With `VISION_PROVIDERS=nvidia` (or an invalid Gemini key to force failure), the same photo returns a validated scene via NVIDIA, or Raw Mode with `invalid`, and either way does not 500. Report the actual result and latency honestly.
- [ ] A photo of random clutter returns `mode: "raw"` without crashing.
- [ ] End-to-end latency stays under 15 s in the fallback case (Gemini failing at its 8 s cap, then NVIDIA).
- [ ] No edits to `validate.py`, `schema.py`, `scene.gen.ts`, `frontend/src/core/**`, property tests, `.kiro/**`.

## Report
Write `docs/handoffs/T08-report.md` **last** (then tell Claude Code "review T08"; Kiro's review hook is dormant while Kiro is paused). Include: files changed; commands run with results; which NVIDIA model you chose, its image size limit and the measured latency; real-photo results for both providers; deviations; "Needs from Kiro" (e.g. changes to the `validate_scene` contract). Add a `docs/BUILD_LOG.md` entry with tool = Antigravity.

Do not tick checkboxes in `tasks.md`. Do not commit or push.
