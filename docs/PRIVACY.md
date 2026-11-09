# Ghost Touch Privacy Policy & Data Architecture

> **Notice:** This document is an honest, plain-language description of data privacy and network flows in Ghost Touch, derived directly from static verification of the codebase. Anything that cannot be verified from code alone is explicitly marked as **UNVERIFIED**.

---

## 1. Quick Summary (For Teachers and Parents)

Ghost Touch is an open-source assistive web application designed to help blind and low-vision students explore diagrams through vibration, sound, and spoken words on an Android phone.

- **No Student Accounts:** Students never log in, create usernames, enter passwords, or provide personal details.
- **No Analytics or Trackers:** There are no tracking scripts, advertising trackers, analytics libraries, or telemetry SDKs installed in the app.
- **Photos Go to AI Providers for Processing:** When a student takes or selects a photo of a diagram, that photo is sent to our backend server and then to an AI vision service (Google Gemini, OpenAI, or Nebius Token Factory) to convert lines and shapes into coordinate data.
- **Photos Are Not Kept on Our Servers:** Our backend does not write photos to disk or keep them in a database. It temporarily caches the resulting line/point coordinate data in memory for up to 6 hours to save processing quota on repeated scans; the photo itself is discarded after processing.
- **Saved Diagrams Stay on the Phone:** Diagrams that students choose to save are stored exclusively in the phone browser's local database (IndexedDB). They are never synced or uploaded to our server.
- **Voice Questions:** When a student speaks a question using the microphone, Android Chrome's built-in speech recognition transcribes the audio. The browser vendor (Google) may process this audio according to their own platform privacy policies. Ghost Touch only receives the transcribed text.
- **Teacher Shared Diagrams:** Diagrams shared by teachers are compressed directly into the URL web address (the `#` fragment). Opening a shared diagram requires zero communication with our backend server.

---

## 2. In-App Notice (3-Sentence Version)

### English
Ghost Touch sends diagram photos and questions to our backend and AI vision providers (Google Gemini, OpenAI, or Nebius) to turn them into touchable outlines. We do not store your photos or create user accounts, and your saved diagrams and settings remain strictly on your device. When using voice input, your browser vendor (such as Google on Chrome) processes your speech to transcribe questions.

### Hindi
> [!NOTE]
> *[Machine-translated — needs native review]*

घोस्ट टच चित्र की तस्वीरों और प्रश्नों को स्पर्शनीय रूपरेखा में बदलने के लिए हमारे बैकएंड और एआई विज़न प्रदाताओं (गूगल जेमिनी, ओपनएआई, या नेबियस) को भेजता है। हम आपकी तस्वीरों को संग्रहीत नहीं करते हैं और न ही कोई उपयोगकर्ता खाता बनाते हैं, और आपके सहेजे गए आरेख और सेटिंग्स पूरी तरह से आपके डिवाइस पर ही रहते हैं। ध्वनि इनपुट का उपयोग करते समय, आपका ब्राउज़र प्रदाता (जैसे क्रोम पर गूगल) प्रश्नों को लिखने के लिए आपकी आवाज़ को प्रोसेस करता है।

### Gujarati
> [!NOTE]
> *[Machine-translated — needs native review]*

ઘોસ્ટ ટચ આકૃતિના ફોટા અને પ્રશ્નોને સ્પર્શક્ષમ રૂપરેખામાં રૂપાંતરિત કરવા માટે અમારા બેકએન્ડ અને એઆઈ વિઝન પ્રદાતાઓ (ગુગલ જેમિની, ઓપનએઆઈ, અથવા નેબિયસ) ને મોકલે છે. અમે તમારા ફોટા સંગ્રહિત કરતા નથી અથવા કોઈ વપરાશકર્તા ખાતું બનાવતા નથી, અને તમારા સાચવેલા આરેખ તેમજ સેટિંગ્સ સંપૂર્ણપણે તમારા ડિવાઇસ પર જ રહે છે. વૉઇસ ઇનપુટનો ઉપયોગ કરતી વખતે, તમારા બ્રાઉઝર પ્રદાતા (જેમ કે ક્રોમ પર ગુગલ) પ્રશ્નોનું લખાણ બનાવવા માટે તમારા અવાજને પ્રોસેસ કરે છે.

---

## 3. Data Flow Architecture

The table below summarizes every category of data handled by Ghost Touch, where it originates, where it travels, and where it resides:

| Data Category | Origin | Leaves Device? | Destination & Third Parties | Stored on Server? | Stored on Device? |
|---|---|---|---|---|---|
| **Camera Photos / Uploaded Images** | Phone Camera / File Picker | Yes | FastAPI Backend & Vision Providers (Gemini / OpenAI / Nebius) | **No** (only coordinate scene cached in RAM; image bytes discarded) | In browser RAM during active session (`blob:` URL); revoked on navigation |
| **Questions (Ask Feature)** | Microphone / On-Screen Keyboard | Yes | FastAPI Backend & LLM Completion Providers | **No** (only question character length logged; text discarded) | In React state during question; discarded when answered |
| **Raw Voice Audio** | Microphone | Yes (via Browser Engine) | Browser vendor's speech service (e.g. Google speech servers) | **No** (Ghost Touch server never receives audio) | Not stored by Ghost Touch |
| **Saved Diagrams** | Tactile Explore Screen | **No** | None | **No** | Browser IndexedDB (`ghost-touch` DB, max 20 diagrams) |
| **User Settings (Language, Speed, Flags)** | Lab Settings Modal | **No** | None | **No** | Browser `localStorage` |
| **Teacher Shared Links** | Teacher Editor Screen | **No** | None (encoded into client-side URL `#s=...` hash) | **No** (URL fragment is never transmitted over HTTP) | In browser URL bar and browser history |
| **Teacher Corrections Validation** | Teacher Editor Save | Yes | FastAPI Backend (`POST /api/v1/validate`) | **No** (stateless schema validation) | Kept in teacher's browser state |
| **Bundled Samples (Triangle, Sine, Bars)** | Pre-installed App Assets | **No** | None (loaded locally from `/samples/*.json`) | **No** | Bundled static assets |

---

## 4. What Leaves the Phone (Network Transmissions)

### 4.1 Photo Capture and Scene Extraction (`POST /api/v1/scene`)
When a student taps "Take photo" or "Choose image":
1. **Client-side downscaling:** In `frontend/src/drivers/camera.ts`, the image is resized via HTMLCanvasElement so its longest side does not exceed 1600 px at JPEG quality 0.85 (or first page rendered for PDF via `pdfjs-dist`).
2. **Transmission to backend:** The JPEG blob is sent over TLS/HTTPS to `POST /api/v1/scene` (maximum request limit: 10 MB).
3. **Upstream Vision LLMs:** The backend routes the image bytes to the configured provider fallback chain (`backend/app/vision/chain.py`):
   - **Google Gemini:** Model `gemini-3.5-flash-lite` (or configured `GEMINI_MODEL`) via Google GenAI SDK.
   - **OpenAI:** Model `gpt-4.1-mini` (or configured `OPENAI_MODEL`) via OpenAI Chat Completions API.
   - **Nebius Token Factory:** Model `openbmb/MiniCPM-V-4_5` (or configured `NEBIUS_MODEL`) via Nebius Chat Completions API.
   - *Note on Fallback Order:* As configured in `render.yaml`, the default deployment order is `openai,gemini,nebius`. The code default in `backend/app/vision/__init__.py` is `gemini,openai,nebius`.
4. **Graph Equation Route:** If a function graph curve is detected or needs rescue, the image bytes and an equation extraction prompt are sent to the provider chain to sample the curve mathematically (`backend/app/graphs/route.py`).
5. **Background Improve Pass:** If `GEMINI_IMPROVE_MODEL` is enabled, a non-blocking background task sends the image bytes to Gemini to attempt to refine the extracted scene (`backend/app/main.py`).
6. **OpenCV Raw Mode Fallback:** If vision providers fail, time out, or are not configured, the backend runs OpenCV Canny edge detection (`backend/app/raw_mode.py`) locally on the server. **In Raw Mode, the image never leaves our backend server.**

### 4.2 Spoken and Typed Questions (`POST /api/v1/ask`)
When a student asks a question about an active diagram:
1. The student's question text, the current DiagramScene JSON structure, and the user's language code (`en`, `hi`, `gu`) are sent to `POST /api/v1/ask`.
2. **Deterministic Fast Path:** The backend first attempts a semantic target check (`app.semantic`) and deterministic fact lookup (`facts_lookup`). If the question can be resolved directly from diagram data (e.g., "Where is Point A?"), the answer is returned immediately **without sending the question to any third-party AI provider**.
3. **LLM Completion Path:** If deterministic resolution is insufficient, the question and compact scene JSON are bundled into a prompt and sent to the configured provider (Gemini, OpenAI, or Nebius `NEBIUS_TEXT_MODEL`).
4. **Image Exclusion:** The original camera image is **never** sent to `POST /api/v1/ask`; only geometric coordinates and text facts are sent.

### 4.3 Teacher Diagram Verification (`POST /api/v1/validate`)
When a teacher uses Teacher Correct mode to edit point coordinates and clicks "Save":
- The edited `DiagramScene` JSON is transmitted to `POST /api/v1/validate`.
- The backend validates the mathematical structure (bounds in [0, 1], point limits).
- The photo is **not** transmitted.

### 4.4 Diagram Sharing via Link or QR Code
When a teacher shares a diagram:
- The diagram, teacher name, and optional note are compressed using LZ-String and appended to the URL fragment (`#s=...`).
- **Zero Server Transmission:** Web browsers do not send URL fragments to HTTP servers. Opening or sharing a link occurs completely client-side without pinging the backend API.

---

## 5. What the Backend Stores (Server State & Caching)

Ghost Touch is designed as a stateless API service. It does not use PostgreSQL, MySQL, SQLite, Redis, or local disk persistence for user data.

### 5.1 In-Memory Scene Cache (`backend/app/scene_cache.py`)
To prevent repeated uploads of the same diagram from burning AI quota or slowing down classroom demos, the backend maintains an in-memory cache:
- **Key:** SHA-256 cryptographic digest of `(image bytes + prompt + version)`.
- **Value:** The validated `DiagramScene` JSON payload, timestamp, and provider name.
- **CRITICAL VERIFIED FACT:** **The uploaded image itself is NOT stored in the cache.** Only the extracted mathematical scene JSON is stored.
- **Cache Size Limit:** Maximum 64 entries (`SCENE_CACHE_SIZE`).
- **Time-to-Live (TTL):** 6 hours (21,600 seconds, `SCENE_CACHE_TTL_SECONDS`).
- **Failures & Raw Mode Excluded:** Raw Mode edge scenes and failed attempts are never cached.
- **Volatile Storage:** Stored purely in Python process RAM. All entries are erased whenever the server process restarts or sleeps on Render free tier.

### 5.2 Rate Limiting Memory (`backend/app/limits.py`)
- Rate limiting records are kept in a memory structure (`_HITS`) tracking client request timestamps within a 60-second sliding window.
- The table is swept every 5 seconds to discard expired records. It is never written to disk.

---

## 6. What Is Logged on the Backend Server

Our backend application uses standard Python logging. We examined every logger call across `backend/app/`:

### 6.1 What Is Logged
- **Processing Metadata:** Timestamps, elapsed milliseconds, processing mode (`ai` or `raw`), and provider used (`gemini`, `openai`, `nebius`, `none`).
- **Question Character Length Only:** When a question is asked, the server logs:
  ```text
  ask processed: provider=gemini source=ai question_len=24 scene_points=3 elapsed_ms=812
  ```
  **The actual text of the student's question is NOT written to server logs.**
- **Diagram Complexity Only:** Only the count of scene points (`scene_points=%d`) is logged, not coordinates or element labels.
- **Rate Limit Hits:** `rate limit hit: path=/api/v1/ask` (client IP is **not** logged in this message).
- **Service Configuration:** CORS allowed origins and startup timeout configuration.

### 6.2 Secret Redaction
- In `backend/app/vision/_openai_compat.py` and `backend/app/vision/gemini.py`, regex filters (`_BEARER`, `_SK_KEY`, `_redact_secrets`) scrub API keys and authorization tokens from error text before logging.

---

## 7. What Stays on the Phone (Device-Local Storage)

### 7.1 Browser IndexedDB (`ghost-touch` Database)
- **Saved Diagrams:** When a student pins or saves a diagram from the Explore screen, it is saved in IndexedDB (`saved-diagrams` object store).
- **Stored Fields:**
  - `id`: Random collision-resistant identifier (e.g. `l1a2b3-x9z8y7`).
  - `createdAt`: Millisecond timestamp.
  - `title`: Display and spoken title.
  - `thumbnailDataUrl`: A mini 120×120 px canvas drawing of green diagram lines on a dark background. **This is NOT a camera photo.**
  - `scene`: The full `DiagramScene` JSON structure.
  - `pinned`: Boolean flag preventing auto-eviction.
- **Storage Limit:** Hard limit of 20 diagrams (`SAVED_DIAGRAMS_CAP`). Oldest unpinned diagrams are evicted when full.
- **Sync:** **Never synchronized to any cloud service.**

### 7.2 Browser `localStorage`
Ghost Touch stores only non-identifying user preference flags in `localStorage`:
- `gt_language`: Language choice (`en`, `hi`, `gu`).
- `gt_speech_rate`: Speech synthesizer speed (`slow`, `normal`, `fast`).
- `gt_guide_enabled`: User toggle for directional finger guidance (`true`, `false`).
- `gt_teacher_enabled`: User toggle for teacher editing tools (`true`, `false`).

### 7.3 Transient Memory Photos
- High-resolution camera photos chosen during a session exist only as transient in-memory objects (`URL.createObjectURL(blob)`).
- When the student navigates away or takes a new picture, `URL.revokeObjectURL()` frees the memory. Photos are never saved to IndexedDB or localStorage.

---

## 8. Voice & Audio Processing

1. **Text-to-Speech (TTS):** The app uses the standard browser `speechSynthesis` API to speak button labels, screen transitions, and diagram facts. Speech is synthesized on-device or by the operating system speech engine.
2. **Speech Recognition (Voice Q&A):** The app uses the standard browser `SpeechRecognition` (or `webkitSpeechRecognition`) API.
   - **Vendor Audio Processing:** On Android Chrome, the Web Speech API sends audio data to Google's speech recognition cloud services to perform speech-to-text conversion.
   - **Ghost Touch Role:** Ghost Touch has no access to the raw microphone audio stream; it only receives the resulting string transcript from the browser.

---

## 9. Accounts, Tracking, and Telemetry

- **User Accounts:** Ghost Touch has zero concept of accounts, login screens, passwords, session cookies, or user IDs.
- **No Analytics / Telemetry:** Verification of `frontend/package.json` and backend dependencies confirms that **no tracking or analytics packages** are present:
  - No Google Analytics / Google Tag Manager.
  - No Firebase Analytics.
  - No Mixpanel, PostHog, Segment, or Amplitude.
  - No Sentry or Datadog client SDKs.
  - No advertising networks or tracking pixels.

---

## 10. Third-Party Vision Providers (UNVERIFIED Policies)

When Ghost Touch sends photos or questions to vision providers, data handling is governed by those providers' terms:
- **Google Gemini API:** Subject to Google Cloud / Google AI terms.
- **OpenAI API:** Subject to OpenAI API data privacy terms (OpenAI states API data is not used to train models unless opted in).
- **Nebius Token Factory:** Subject to Nebius Token Factory service terms.

> [!IMPORTANT]
> **UNVERIFIED STATUS:** We can verify from our code that images and questions are transmitted over encrypted HTTPS to these providers. However, how long Google, OpenAI, or Nebius retain server-side inference payloads or whether they log inputs on their internal infrastructure **cannot be verified from our code repository**.

---

## 11. Code Findings & Privacy Gaps

During our thorough audit of the backend and frontend codebases, we identified the following privacy characteristics and gaps:

1. **Provider Error Messages in Server Logs (Minor Gap):**
   In `backend/app/vision/chain.py` and `backend/app/vision/_openai_compat.py`, when an external provider returns an HTTP error, the first 200 characters of the provider's response text are included in exception strings and logged at `WARNING` level (`logger.warning("Vision provider %s failed: %s", ...)`). While API keys are redacted, if a provider ever echoed user input inside an error message, a fragment might appear in server error logs.
2. **Web Speech API Browser Vendor Dependence:**
   Voice questions rely on the browser's native `SpeechRecognition` API. On Chrome for Android, audio is transmitted to Google servers for transcription. Users who do not want audio processed by Google can type questions using the on-screen text input.
3. **Client IP Identification for Rate Limiting:**
   In `backend/app/limits.py`, the backend inspects client network peers or the `X-Forwarded-For` header (up to `TRUSTED_PROXY_HOPS`) to construct a rate-limiting key. This key is stored in server RAM for 60 seconds to prevent denial-of-service attacks, but is not written to persistent disk logs.
4. **Equation Extraction Route Retransmission:**
   If a diagram is recognized as a mathematical graph, the backend sends a second request containing the image to the provider chain to sample the curve equation (`backend/app/graphs/route.py`). This is a functional requirement for curve sonification, but means two provider calls receive the diagram image.
5. **Background Improve Pass:**
   If `GEMINI_IMPROVE_MODEL` is configured in environment variables, an asynchronous background task re-submits the image bytes to Gemini to seek a higher-fidelity scene. This feature is opt-in and disabled by default.

---

## 12. Verification Matrix

| Claim | Status | Source Verification |
|---|---|---|
| Photos leave the phone | **VERIFIED** | `frontend/src/api/scene.ts`, `backend/app/main.py` |
| Photos forwarded to Gemini, OpenAI, Nebius | **VERIFIED** | `backend/app/vision/chain.py`, `render.yaml` |
| Backend does not store photos on disk | **VERIFIED** | `backend/app/main.py`, `backend/app/scene_cache.py` |
| Scene cache stores only JSON, not image bytes | **VERIFIED** | `backend/app/scene_cache.py` (`payload` holds `scene` dict, not `image`) |
| Scene cache expires in 6 hours / 64 entries | **VERIFIED** | `backend/app/scene_cache.py` (defaults 64 entries, 21600s TTL) |
| Question text is not written to server logs | **VERIFIED** | `backend/app/ask.py` (`question_len=%d` only) |
| Saved diagrams stay strictly on phone | **VERIFIED** | `frontend/src/drivers/diagramStore.ts`, `core/savedDiagrams.ts` |
| Settings stay strictly on phone | **VERIFIED** | `frontend/src/drivers/storage.ts`, `localStorage` |
| Zero analytics / telemetry packages | **VERIFIED** | `frontend/package.json`, `backend/pyproject.toml` |
| Shared links never touch backend | **VERIFIED** | `frontend/src/share/codec.ts` (`#s=` URL hash) |
| Raw Mode processes images with zero AI calls | **VERIFIED** | `backend/app/raw_mode.py` (pure OpenCV Canny) |
| Provider internal data retention / training | **UNVERIFIED** | External provider terms (outside codebase control) |
| Live Render proxy hop count in production | **UNVERIFIED** | Host environment variable `TRUSTED_PROXY_HOPS` |
