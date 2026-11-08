# Lane h5-privacy-docs Report: Privacy Documentation (`docs/PRIVACY.md`)

- **Lane:** `h5-privacy-docs`
- **Tool:** Antigravity (agy)
- **Status:** DONE
- **Date:** 2026-11-08

---

## 1. Executive Summary

In accordance with `docs/briefs/agy-h5-privacy-docs.md`, `AGENTS.md`, and the headless run instructions, Antigravity conducted a read-only audit of the Ghost Touch codebase to author an honest, plain-language privacy policy document: [`docs/PRIVACY.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-h5-privacy-docs/docs/PRIVACY.md).

No source code was edited or modified. No environment variable files (`.env*`) were opened or read. All claims in `docs/PRIVACY.md` are grounded strictly in code verification, and any external cloud provider practices that cannot be proven from code are designated as **UNVERIFIED**.

---

## 2. Code Verification Findings

### 2.1 What Leaves the Phone
- **Photos / Captured Images:**
  - Resized and compressed in browser memory via HTMLCanvasElement to a maximum of 1600 px on the longest side (JPEG quality 0.85; `frontend/src/drivers/camera.ts`). PDFs have their first page extracted and rendered to canvas via `pdfjs-dist` (`frontend/src/drivers/pdf.ts`).
  - Transmitted via HTTPS to `POST /api/v1/scene` (body limit 10 MB + multipart overhead; `backend/app/main.py`, `backend/app/limits.py`).
  - Forwarded by the backend to configured vision LLMs:
    - **Google Gemini:** `gemini-3.5-flash-lite` via `google-genai` SDK (`backend/app/vision/gemini.py`).
    - **OpenAI:** `gpt-4.1-mini` via HTTP chat completions (`backend/app/vision/openai_provider.py`).
    - **Nebius Token Factory:** `openbmb/MiniCPM-V-4_5` via HTTP chat completions (`backend/app/vision/nebius.py`).
    - *Fallback order:* Default in `render.yaml` is `openai,gemini,nebius`; default in `backend/app/vision/__init__.py` is `gemini,openai,nebius`.
  - **OpenCV Raw Mode:** When vision providers fail, time out, or are unconfigured, OpenCV Canny edge detection runs on the backend server (`backend/app/raw_mode.py`). No image is sent to any external AI provider in Raw Mode.
  - **Graph Route:** For function graphs, an equation extraction prompt and the image are sent to the provider chain to sample curves mathematically (`backend/app/graphs/route.py`).
  - **Improve Pass:** If `GEMINI_IMPROVE_MODEL` is set, an async non-blocking task sends the image to Gemini (`backend/app/main.py`).
- **Questions (Ask Feature):**
  - Transmitted via HTTPS to `POST /api/v1/ask` (`frontend/src/api/ask.ts`).
  - Includes question string, compact `DiagramScene` JSON, and language code.
  - Does **not** include the photo.
  - Evaluated first by deterministic facts lookup and semantic resolution (`app.semantic`, `facts_lookup`). If resolved locally, no third-party call is made.
  - If unresolved, sent to Gemini, OpenAI, or Nebius (`NEBIUS_TEXT_MODEL`).
- **Teacher Diagram Verification:**
  - Diagram coordinates and note compressed using LZ-String into the URL fragment hash (`#s=...`; `frontend/src/share/codec.ts`).
  - URL fragments are client-side only and never sent over HTTP to the backend.
  - When saving in Teacher Correct mode, the scene JSON is validated at `POST /api/v1/validate` (`backend/app/main.py`); no image is sent.
- **Health Check & Bundled Samples:**
  - `GET /api/v1/health` wakes up the Render backend on page load; sends no user data (`frontend/src/api/health.ts`).
  - Bundled samples (`/samples/*.json`) work 100% offline with zero network calls (`frontend/src/api/scene.ts`).

### 2.2 What the Backend Stores
- **In-Memory Scene Cache (`backend/app/scene_cache.py`):**
  - Thread-safe LRU cache storing up to 64 entries (`SCENE_CACHE_SIZE`).
  - Time-to-live of 6 hours (21,600 s; `SCENE_CACHE_TTL_SECONDS`).
  - Keyed by SHA-256 hash of `(image bytes + prompt + version)`.
  - Stored value: `(stored_at, payload, provider)` where `payload` contains `{"scene": DiagramScene, "mode": "ai"}`.
  - **Verification:** The uploaded image itself is **NEVER** kept in the cache or written to disk. Only the validated JSON scene and provider name are cached.
  - Raw Mode scenes and failed attempts are never cached.
  - Volatile: exists only in Python process RAM. Destroyed on server restart or container sleep.
- **Rate Limit Window (`backend/app/limits.py`):**
  - In-memory `_HITS` dictionary tracking client request timestamps within a 60-second window. Swept every 5 seconds. Stored in RAM only.
- **Database / File Storage:**
  - None. No PostgreSQL, MySQL, SQLite, MongoDB, Redis, or disk uploads.

### 2.3 What Is Logged
- **Operational Logs:**
  - `scene processed: provider=%s mode=ai reason=none%s elapsed_ms=%d`
  - `scene processed: provider=%s mode=raw reason=%s elapsed_ms=%d`
  - `scene served from cache: provider=%s`
  - `ask processed: provider=%s source=%s question_len=%d scene_points=%d elapsed_ms=%d`
  - `rate limit hit: path=%s` (client IP is **not** logged)
  - CORS origins and configuration warnings on startup.
- **User Data Invariance in Logs:**
  - The server logs `question_len` (character length of question), but **NEVER logs the question text**.
  - The server logs `scene_points` (count of points), but **NEVER logs diagram coordinate contents or labels**.
- **Secret Redaction:**
  - API keys, `Bearer` tokens, and `sk-*` keys are redacted from error messages before logging (`_openai_compat.py`, `gemini.py`).
- **Privacy Gaps in Logs:**
  - Upstream provider error messages (first 200 characters of HTTP response bodies from OpenAI/Nebius or Google GenAI API error messages) are logged as warnings upon provider failure.

### 2.4 What Stays on the Phone
- **IndexedDB (`ghost-touch` Database, `saved-diagrams` Store):**
  - Stores up to 20 saved diagrams (`SAVED_DIAGRAMS_CAP = 20`; `frontend/src/core/savedDiagrams.ts`, `frontend/src/drivers/diagramStore.ts`).
  - Stores ID, creation timestamp, title, canvas thumbnail data URL, scene JSON, and pinned boolean.
  - The thumbnail is a mini vector drawing rendered on canvas, **NOT a camera photo**.
  - Stored purely in the user's browser; never synced or uploaded to any server.
- **Browser `localStorage`:**
  - `gt_language` ('en' | 'hi' | 'gu')
  - `gt_speech_rate` ('slow' | 'normal' | 'fast')
  - `gt_guide_enabled` ('true' | 'false')
  - `gt_teacher_enabled` ('true' | 'false')
- **Photos in Memory:**
  - Kept in browser memory as object URLs (`blob:...`) during explore or correction mode.
  - Automatically revoked via `URL.revokeObjectURL()` on navigation. Never persisted to IndexedDB or localStorage.

### 2.5 Voice & Audio
- **Speech Recognition (`SpeechRecognition` / `webkitSpeechRecognition`):**
  - Voice questions use the browser's native Web Speech API.
  - In Chrome on Android, audio data is sent by the browser to Google's speech recognition cloud servers per Google's platform privacy policies. Ghost Touch receives only the final transcript string.
- **Text-to-Speech (`speechSynthesis`):**
  - Audio voice feedback is synthesized on-device or via the platform TTS engine.
- **Web Audio & Vibration:**
  - Theremin pitch and haptic vibrations are generated 100% locally on device hardware.

### 2.6 Accounts & Analytics Absence
- **No User Accounts:** No login, passwords, session tokens, user IDs, or cookies.
- **Zero Analytics/Telemetry Packages:**
  - Inspected `frontend/package.json`: contains only React, Vite, fast-check, Vitest, `lz-string`, `pdfjs-dist`, `qrcode`.
  - Zero Google Analytics, Firebase, Mixpanel, PostHog, Sentry, Datadog, or ad trackers.
  - Backend dependencies inspected in `backend/pyproject.toml`: FastAPI, uvicorn, pydantic, python-multipart, google-genai, opencv-python-headless, numpy, httpx, pytest, hypothesis, ruff. Zero telemetry libraries.

---

## 3. Deliverables Completed

1. [`docs/PRIVACY.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-h5-privacy-docs/docs/PRIVACY.md):
   - Created full, plain-language privacy documentation from code verification.
   - Included "For teachers and parents" summary section.
   - Included 3-sentence in-app notice in English, Hindi, and Gujarati (Hindi and Gujarati explicitly marked as needing native review).
   - Included comprehensive data flow table and network transmission details.
   - Included backend storage, caching limits, and volatile memory specifications.
   - Included server logging details and secret redaction rules.
   - Included device-local storage (IndexedDB, localStorage, photo memory).
   - Included voice and audio privacy disclosures.
   - Included findings and privacy gaps list.
   - Included Verification Matrix distinguishing VERIFIED vs UNVERIFIED.
2. **README.md Link Check:**
   - Per brief instruction: *"add a one-line link to PRIVACY.md in README.md ONLY if README already has a docs/links section."*
   - Inspected `README.md`: confirmed it does **not** have a docs/links section. In accordance with the brief and "No source edits" rule, `README.md` was not modified.
3. [`docs/BUILD_LOG.md`](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-h5-privacy-docs/docs/BUILD_LOG.md):
   - Appended a structured entry for Antigravity documenting the privacy audit and documentation creation.
4. **Lane Report:**
   - Updated this file (`docs/reports/agy-h5-privacy-docs-report.md`) with status set to DONE.

---

## 4. Verification Proof

- `git status --short`: Verified only permitted files were touched:
  - `docs/PRIVACY.md` (new file)
  - `docs/reports/agy-h5-privacy-docs-report.md` (new file)
  - `docs/BUILD_LOG.md` (appended entry)
- No forbidden commands were run.
- Zero source files or Kiro-owned files modified.
