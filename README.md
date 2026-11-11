<p align="center">
  <img src="frontend/public/brand/logo-full.svg" alt="Ghost Touch" width="400" />
</p>

# Ghost Touch 👻

[![CI](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml)
[![Gitleaks](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml)

Ghost Touch is a Frankenstein creature stitched from spare phone components: an inexpensive notification buzzer for tactile nerves, a vision LLM for eyes, and a Web Audio theremin synthesizer for voice. It turns photos, screenshots, or PDF pages of STEM diagrams into tactile graphics that blind and low-vision students explore by touch on an ordinary Android phone. As students trace shapes on the screen, the phone vibrates along lines, pulses at corners, plays rising tones along curves, and answers spoken questions about the picture.

## Try it

> **Quick test for judges:**
> 1. Open the live URL and press the start button.
> 2. Pick the Right triangle sample diagram.
> 3. Drag a finger or mouse along a side, press Ask and type "How long is AC?".
> Plainly: on a laptop or iPhone there is no vibration motor (Chrome on Android is needed to feel it). There the app plays an audible buzz and shows a pulse ring instead, and says so once on entering Explore.

- **Live frontend (PWA):** [https://ghost-touch-iota.vercel.app](https://ghost-touch-iota.vercel.app)
- **Live backend API:** [https://ghost-touch-api.onrender.com](https://ghost-touch-api.onrender.com)
- **Target environment:** Android Chrome (iOS does not support web vibration, so iOS is out of scope).
- **Cold-start notice:** The backend runs on the Render free tier; if idle, the first request takes 30 to 60 seconds (up to 70 seconds under heavy load) to wake up.
- **Resilience floor:** If AI providers are slow or unconfigured, the pipeline falls back to OpenCV edge detection (Raw Mode) so students are never left with an empty screen.

## How it feels

| Start Screen | Capture & Samples | Tactile Explore | Teacher Correction |
| :---: | :---: | :---: | :---: |
| ![Start screen](docs/design/screenshots/after-start-390x844.png) | ![Capture screen](docs/design/screenshots/after-capture-390x844.png) | ![Explore screen](docs/design/screenshots/after-explore-390x844.png) | ![Teacher Correction screen](docs/design/screenshots/after-correct-390x844.png) |

Haptic and auditory feedback is tuned to keep tactile sensations distinct:
- **Lines vibrate:** Tracing a line buzzes continuously (`vibrate(80)` retriggered every 70 ms).
- **Corners "bzzzz-tap":** At a corner the phone gives a double pulse and speaks the corner's label, for example "C", and enforces a 450 ms quiet period where line buzz is suppressed.
- **Curves sing:** Tracing function graphs plays a continuous theremin pitch (200–1000 Hz) that rises with visual height.
- **TalkBack pass-through:** The TalkBack double-tap-and-hold gesture worked on our prototype on a OnePlus Nord CE6 (docs/research/talkback-spike.md). It has not yet been tested in the full app.
- **Voice Q&A:** Ask questions aloud ("How long is AB?") and receive spoken answers grounded in detected diagram facts.
- **Ghostwriter in Teach mode:** Sighted teachers can add points and join edges at `#/teach` with "Add point" and "Add edge" controls (minimum 48×48 CSS px touch targets, spoken confirmations, and spoken undo), capped at 300 points and 300 segments.
- **Spec Ghost fact check:** A client-side geometric check (`frontend/src/core/verify.ts`) compares printed facts against diagram geometry. If facts contradict the drawing, it speaks a localized caveat ("Facts and drawing disagree on {name}. I can't tell which is right.", using localized angle naming such as "angle C", "कोण C", "ખૂણા C"). It stays silent when consistent or uncertain, and never claims "verified".
- **Guide my finger (Flagged OFF):** Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone. When enabled, provides directional audio/haptic guidance toward diagram elements, peaks, or Ask targets (e.g. "take me to B", "find the peak", or Ask followed by "Guide me"). Pulses accelerate as the finger approaches, Web Audio pitch indicates vertical direction, and dynamic stereo pan guides horizontal position on headphones. Phone speakers receive spoken directional hints ("left", "up-right", "here"). Cancelable at any time by voice ("stop"), Back button, or a 20-second timeout, concluding with a distinct arrival buzz. (Requires `VITE_FEATURE_GUIDE=1` and Settings toggle).
- **Teacher verify & share (Flagged OFF):** Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone. Sighted teachers can review, adjust, and stamp diagrams with their name and note at `#/teach`. Diagrams are compressed into URL fragment hashes (`#s=...`) using `lz-string` and shared via direct link or on-screen QR code. Students open shared diagrams offline via an accessible tap-to-open gate, greeted by an honest "Shared by [Name], not checked" banner and speech announcement with zero server round-trips. Names and titles are stripped of spoofed badges and checkmarks. (Requires `VITE_FEATURE_SHARE=1` and Settings toggle).
  > **Note on verification:** Ghost Touch does not verify shared diagrams: a shared link is announced as "Shared by <name>, not checked". Shared links live in the URL fragment and never reach our server.

### Tuned haptic vocabulary

| Sensation | Physical Pattern | Sound & Speech | Tuned Purpose |
|---|---|---|---|
| Line trace | `vibrate(80)` retriggered every 70 ms | Theremin pitch on curves | Feels continuous |
| Leaving line | `vibrate(0)` | Pitch silenced | Instant feedback when stepping off an edge |
| Vertex / corner | `vibrate([50, 90, 50])` | Speaks corner's label, e.g. "C" | Distinct double pulse with 450 ms quiet window |
| Graph curve | Line buzz retriggered | 200–1000 Hz sine | Higher screen coordinate = higher pitch |
| Centre reference tick | `vibrate(25)` | Short audio tick | Crisp haptic anchor upon gesture hold start |

Hit radii: vertex 22 CSS px (priority over lines), line 14 CSS px.

## Architecture

```text
Photo / PDF ──> FastAPI Backend ──> Vision Chain (Gemini [code default] / OpenAI [Render default] ──> Nebius ──> Raw Mode)
                                           │
                                           ▼
                                   DiagramScene JSON (Normalized [0, 1])
                                           │
                                           ▼
                                 Pure Core TypeScript (geometry, hitTest, hapticEngine, pitch, correct)
                                           │
                                           ▼
                             Browser Drivers (vibration, Web Audio, speech, camera, storage)
```

- **FastAPI backend (`backend/`):** Orchestrates the multi-provider vision chain (Google Gemini primary in code default, OpenAI primary in production `render.yaml`, Nebius fallback, OpenCV Canny edge detection in `Raw Mode`), validates JSON schema invariants, and provides Q&A endpoints.
- **Pure core (`frontend/src/core/`):** Pure TypeScript decision logic free of DOM or browser APIs, handling coordinate normalization, letterboxing, hit testing, haptic sequencing, and pitch calculations.
- **Browser drivers (`frontend/src/drivers/`):** Thin isolation wrappers for `navigator.vibrate`, Web Audio API, Web Speech API, camera, and IndexedDB storage.

## Project structure

```text
ghost-touch/
├── .github/          # CI, CodeQL, Gitleaks workflows, Dependabot config
├── .kiro/            # Specs (requirements, design, tasks), steering docs, hooks
├── backend/          # FastAPI, multi-provider vision pipeline, OpenCV edge detection, pytest
├── frontend/         # React 19 + Vite PWA, pure core geometry/haptics, Vitest property suites
├── prototypes/       # haptics-test.html device reference spike
├── research/         # Vision benchmarking, ground truth scoring, and test scripts
├── scripts/          # setup-dev.ps1, agy-run runner scripts, allowlist settings
├── docs/             # Briefs, handoffs, reviews, test kits, BUILD_LOG.md, DEPLOY.md
└── README.md
```

## Accessibility commitments

- **48×48 px targets:** Controls are tested for 48 px targets; state changes are spoken (see tests/a11y.*).
- **7:1 contrast (WCAG AAA):** Laboratory color tokens exceed 7:1 contrast on deep charcoal backgrounds (`#0b0e0c`).
- **Atkinson Hyperlegible:** Self-hosted Braille Institute font optimized for low-vision character distinction.
- **Spoken state changes:** State changes are spoken and announced via speech synthesis and ARIA live regions (see tests/a11y.*).
- **Reduced motion:** Full `prefers-reduced-motion` compliance, disabling glows and animations.
- **Offline PWA:** Progressive Web App with service worker precaching and built-in sample diagrams that work offline.

## Built with Kiro, Antigravity and Claude Code

Ghost Touch was built collaboratively using three agent tools. Git log history shows over 300 commits authored under the repository owner's identity, so commit authorship does not reflect individual tool contributions. See [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md), [docs/kiro-evidence/round2.md](docs/kiro-evidence/round2.md), and [docs/BUILD_LOG.md](docs/BUILD_LOG.md) for complete verifiable evidence.

| Tool | Role & Contributions | Evidence / Key Files |
|---|---|---|
| **Kiro** (IDE & CLI) | **Foundational Architecture, Specs, Pure Core & Invariants:**<br>• Authored EARS `requirements.md`, `design.md` (P1–P15), and `tasks.md` in `.kiro/specs/ghost-touch/`.<br>• Authored architectural steering docs (`tech.md`, `product.md`, `review.md`) and 9 hooks in `.kiro/hooks/` (5 run checks on save, 4 ask the agent to review or regenerate; the hooks are defined and their patterns checked; a recorded run is not yet captured).<br>• Built pure core modules: `hapticEngine.ts`, `geometry.ts`, `hitTest.ts`, and `pitch.ts`.<br>• Authored Pydantic schema (`schema.py`) and validator (`validate.py`).<br>• Authored property-based test suites P1–P13 and fixed P1 generator flake.<br>• Specified Task 13 (Saved Diagrams).<br>• Authored Round 2 spec (Requirements 16 and 17, tasks 23–28, properties P40–P46), Task 24 (Ask fixes), most T25/T26 code, frontend properties P43/P44, and T26 mutation checks. *(Credits paused during Task 13, resumed for Round 2; Kiro did not build the Lab redesign).*<br>• Round 3 & follow-ups: Authored Spec Ghost spec (Req 18), steering, and review (moving to `core/verify.ts` with aspect/unit fixes); resolved CORE-09 and NEEDS-KIRO-02 (P51); hit-test optimizations (P52, P53); Ghostwriter core `addPoint`/`addSegment` (Req 19, P54–P57); localized angle naming (Task 35); `deletePolyline`/`deleteBar` (Req 21, P62–P65); validator parity fixture (Task 37.3); and test-first property oracles P66–P78 for Round 5 audit invariants (Task 38). | `.kiro/specs/`<br>`.kiro/steering/`<br>`.kiro/hooks/`<br>`frontend/src/core/`<br>`docs/kiro-evidence/` |
| **Antigravity** (agy) | **Lab Redesign, Secondary Core, Drivers & Polish:**<br>• Built the complete Frankenstein Laboratory redesign across parallel lanes (tokens, fonts, brand SVGs, i18n, screens, HUD, previews, PWA precaching).<br>• Built Teacher Correct mode (`core/correct.ts`, `screens/Correct.tsx`, `POST /api/v1/validate`, P16/P17).<br>• Completed Saved Diagrams (`core/savedDiagrams.ts`, P14/P15 suites, IndexedDB driver).<br>• Built browser drivers, screen flows, PDF first-page extraction, and Explore screen with relative cursor.<br>• Implemented backend vision providers (`Gemini`, `OpenAI`, `Nebius`), OpenCV Raw Mode (`raw_mode.py`), and Ask pipeline (`ask.py`).<br>• Built Spec Ghost fact-checking module (P47–P50) and k1 Explore/Ask wiring.<br>• Built Ghostwriter UI in Teach mode (lane g1, Task 36: pure `flow/ghostwriter.ts`, P58–P61, Teach UI controls, undo speech) and v1 audit fixes (eliminated button focus speech cancellation, behavioral jsdom tests).<br>• Built Round-5 audit fixes: p1 (backend MIME `image/jpg`, permit release), p2 (saved diagram atomic eviction and in-place save), p3 (share honesty copy, ShareError single announcement, a11y labels), p5 (P1..P99 IDs in /ask), q1 (share-name prefix loop sanitization for Req 22).<br>• Built post-round hardening lanes: m1 (a11y/tokens), m2 (test quality), m3 (ShareGate/honesty copy), n1 (backend stability), n2 (frontend persistence/504 retry fix), and audits. | `docs/BUILD_LOG.md`<br>`frontend/src/`<br>`backend/app/`<br>`docs/reports/` |
| **Claude Code** (Anthropic) | **Supervision, Orchestration, Review & Integration:**<br>• Supervised all development lanes, authored briefs in `docs/briefs/`, and reviewed all diffs in `docs/reviews/`.<br>• Gated and committed T25/T26, authored backend properties P40–P42 and P45–P46 (`backend/tests/test_round2_props.py`), and assembled T28 evidence.<br>• Launched and monitored agy runs via permission-safe runner (`scripts/agy-run.sh`).<br>• Resolved merge conflicts and captured automated headless Brave screenshots.<br>• Verified production builds and live deployments on Vercel and Render. | `docs/briefs/`<br>`docs/reviews/`<br>`docs/kiro-evidence/round2.md`<br>`scripts/agy-run.sh`<br>`scripts/setup-dev.ps1` |

## Run it locally

Run the idempotent setup script from the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
```

Or run manual commands:
```bash
# Frontend (React 19 + Vite PWA)
npm --prefix frontend install
npm --prefix frontend run dev

# Backend (Python 3.11 + FastAPI)
python -m venv backend/.venv && backend/.venv/Scripts/activate
pip install -e "backend[dev]"
uvicorn app.main:app --app-dir backend --reload --port 8000
```

## Environment variables

| Variable | Target | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google Gemini vision API key (codebase default primary) |
| `OPENAI_API_KEY` | Backend | OpenAI vision API key (Render production primary, fallback in code) |
| `NEBIUS_API_KEY` | Backend | Nebius Token Factory fallback vision API key |
| `VISION_PROVIDERS` | Backend | Provider fallback order (codebase default: `gemini,openai,nebius`; Render production: `openai,gemini,nebius`) |
| `GEMINI_MODEL` | Backend | Model name (default: `gemini-3.5-flash-lite`) |
| `GEMINI_THINKING` | Backend | Thinking level budget (default: `minimal`) |
| `ALLOWED_ORIGINS` | Backend | CORS allowed frontend URLs |
| `VITE_API_URL` | Frontend | Backend API endpoint URL |
| `VITE_FEATURE_GUIDE` | Frontend | Feature flag: "Guide my finger" (`1` = ON, unset = OFF; default OFF) |
| `VITE_FEATURE_SHARE` | Frontend | Feature flag: "Teacher verify & share" (`1` = ON, unset = OFF; default OFF) |

## Tests

Current test suite status: **[RECOUNT] frontend tests across [RECOUNT] files** and **[RECOUNT] backend tests** pass cleanly (supervisor will recount on submission day).

```bash
# Frontend: Vitest and fast-check property tests ([RECOUNT] tests in [RECOUNT] files)
npm --prefix frontend test
npm --prefix frontend exec -- tsc -p frontend --noEmit
npm --prefix frontend run build

# Backend: pytest and Hypothesis property tests ([RECOUNT] tests)
backend/.venv/Scripts/python -m pytest backend
backend/.venv/Scripts/python -m ruff check backend
backend/.venv/Scripts/python -m ruff format --check backend
```

## Status and honest limitations

- **Unverified on hardware:** Automated test suites and browser emulation pass cleanly. Haptic values were tuned by hand on the owner's OnePlus Nord CE6 in the prototype; full-app phone testing is pending. The TalkBack double-tap-and-hold gesture worked on our prototype on a OnePlus Nord CE6 (docs/research/talkback-spike.md). It has not yet been tested in the full app. Physical vibration motor strength and headphone panning have not yet been validated on an actual phone by the owner (`docs/OWNER_CHECKLIST.md`).
- **Guide and Share:** Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone. Ghost Touch does not verify shared diagrams. Shared links live in the URL fragment and never reach our server. Link content is announced as "Shared by <name>, not checked".
- **Security & bug audits ongoing (no "bug free" or "secure" claims):** Comprehensive audits are actively ongoing. Round 2 items CORE-09 (pointer capture) and NEEDS-KIRO-02 (tone sequencing) were resolved by Kiro in Round 3. Round-5 audit fixes hardened backend permits and MIME acceptance, IndexedDB atomic eviction and in-place diagram updates, share-name prefix sanitization, and accessible control labels. Kiro authored test-first property oracles P66–P78 for Round 5 invariants: passing in the repository are P71 (template replacer safety), P72 (saved diagram cap invariant), P73 (pinned diagram immunity), P75 (in-place save preservation), and P66–P70 (prefix sanitization resolved by agy lane q1). Remaining pending oracles from Kiro T38: P74 (non-atomic save path over-cap on delete failure; latent as shipped stores are atomic), P76 (in-place update taking pinned/createdAt from caller contract question), and P77/P78 (share honesty copy and legacy key cleanup).
- **Spec Ghost status:** Spec Ghost (`frontend/src/core/verify.ts`) is a client-side geometric consistency check between printed facts and diagram drawings, wired into Explore and Ask by lane k1. Disputed angles are localized per language ("angle C" in English, "कोण C" in Hindi, "ખૂણા C" in Gujarati per Kiro Task 35). It never claims "verified", remains silent when uncertain, and parses facts on ~35% of sample and research scenes (21 of 60, measured on the sample set).
- **Data privacy:** All image processing is stateless and in-memory. Diagrams are never stored on disk. For detailed data flows, third-party AI provider disclosures, and local storage bounds, see [docs/PRIVACY.md](docs/PRIVACY.md).
- **Machine-translated Hindi and Gujarati:** Interface text and speech synthesis support English, Hindi (`hi`), and Gujarati (`gu`); Hindi and Gujarati translations are machine-translated and have not yet been reviewed by native speakers.
- **AI fallback to Raw Mode on free tier:** The Render backend free tier spins down on idle (~30 to 60s cold start). If upstream vision providers time out or encounter rate limits, the backend drops into OpenCV edge detection (Raw Mode) so students can still feel the outlines.
- **Android only:** The application targets Android Chrome because iOS Safari does not support the Web Vibration API.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for production deployment instructions on Render and Vercel.

## License

MIT
