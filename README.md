<p align="center">
  <img src="frontend/public/brand/logo-full.svg" alt="Ghost Touch" width="400" />
</p>

# Ghost Touch 👻

[![CI](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml)
[![Gitleaks](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml)

Ghost Touch is a Frankenstein creature stitched from spare phone components: an inexpensive notification buzzer for tactile nerves, a vision LLM for eyes, and a Web Audio theremin synthesizer for voice. It turns photos, screenshots, or PDF pages of STEM diagrams into tactile graphics that blind and low-vision students explore by touch on an ordinary Android phone. As students trace shapes on the screen, the phone vibrates along lines, pulses at corners, plays rising tones along curves, and answers spoken questions about the picture.

## Try it

- **Live frontend (PWA):** [https://ghost-touch-iota.vercel.app](https://ghost-touch-iota.vercel.app)
- **Live backend API:** [https://ghost-touch-api.onrender.com](https://ghost-touch-api.onrender.com)
- **Target environment:** Android Chrome (iOS does not support web vibration, so iOS is out of scope).
- **Cold-start notice:** The backend runs on the Render free tier; if idle, the first request takes about 30 seconds to wake up.
- **Resilience floor:** If AI providers are slow or unconfigured, the pipeline falls back to OpenCV edge detection (Raw Mode) so students are never left with an empty screen.

## How it feels

| Start Screen | Capture & Samples | Tactile Explore | Teacher Correction |
| :---: | :---: | :---: | :---: |
| ![Start screen](docs/design/screenshots/after-start-390x844.png) | ![Capture screen](docs/design/screenshots/after-capture-390x844.png) | ![Explore screen](docs/design/screenshots/after-explore-390x844.png) | ![Teacher Correction screen](docs/design/screenshots/after-correct-390x844.png) |

Haptic and auditory feedback is tuned to keep tactile sensations distinct:
- **Lines vibrate:** Tracing a line buzzes continuously (`vibrate(80)` retriggered every 70 ms).
- **Corners "bzzzz-tap":** Vertices emit a `vibrate([50, 90, 50])` pattern, speak point labels, and enforce a 450 ms quiet period where line buzz is suppressed.
- **Curves sing:** Tracing function graphs plays a continuous theremin pitch (200–1000 Hz) that rises with visual height.
- **TalkBack pass-through:** Supports TalkBack double-tap-and-hold relative dragging, with a 25 ms centre reference tick on touch start.
- **Voice Q&A:** Ask questions aloud ("How long is AB?") and receive spoken answers grounded in detected diagram facts.

### Tuned haptic vocabulary

| Sensation | Physical Pattern | Sound & Speech | Tuned Purpose |
|---|---|---|---|
| Line trace | `vibrate(80)` retriggered every 70 ms | Theremin pitch on curves | Feels continuous |
| Leaving line | `vibrate(0)` | Pitch silenced | Instant feedback when stepping off an edge |
| Vertex / corner | `vibrate([50, 90, 50])` | Speaks point label | Distinct "bzzzz-tap" with 450 ms line quiet window |
| Graph curve | Line buzz retriggered | 200–1000 Hz sine | Higher screen coordinate = higher pitch |
| Centre reference tick | `vibrate(25)` | Short audio tick | Crisp haptic anchor upon gesture hold start |

Hit radii: vertex 22 CSS px (priority over lines), line 14 CSS px.

## Architecture

```text
Photo / PDF ──> FastAPI Backend ──> Vision Chain (OpenAI ──> Gemini ──> Nebius ──> Raw Mode)
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

- **FastAPI backend (`backend/`):** Orchestrates the multi-provider vision chain (`OpenAI` → `Gemini` → `Nebius` → OpenCV Canny edge detection in `Raw Mode`), validates JSON schema invariants, and provides Q&A endpoints.
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

- **48×48 px targets:** Every interactive button and control meets or exceeds 48×48 CSS px for accessible touch.
- **7:1 contrast (WCAG AAA):** Laboratory color tokens exceed 7:1 contrast on deep charcoal backgrounds (`#0b0e0c`).
- **Atkinson Hyperlegible:** Self-hosted Braille Institute font optimized for low-vision character distinction.
- **Spoken state changes:** Every screen transition, coordinate tick, and mode change is announced via speech synthesis and ARIA live regions.
- **Reduced motion:** Full `prefers-reduced-motion` compliance, disabling glows and animations.
- **Offline PWA:** Progressive Web App with service worker precaching and built-in sample diagrams that work offline.

## Built with Kiro, Antigravity and Claude Code

Ghost Touch was built collaboratively using three agent tools. Git log history shows 303 commits authored under the repository owner's identity, so commit authorship does not reflect individual tool contributions. See [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md) and [docs/BUILD_LOG.md](docs/BUILD_LOG.md) for complete verifiable evidence.

| Tool | Role & Contributions | Evidence / Key Files |
|---|---|---|
| **Kiro** (IDE & CLI) | **Foundational Architecture, Specs, Pure Core & Invariants:**<br>• Authored EARS `requirements.md`, `design.md` (P1–P15), and `tasks.md` in `.kiro/specs/ghost-touch/`.<br>• Authored architectural steering docs (`tech.md`, `product.md`, `review.md`) and 5 agent hooks (`.kiro/hooks/`).<br>• Built pure core modules: `hapticEngine.ts`, `geometry.ts`, `hitTest.ts`, and `pitch.ts`.<br>• Authored Pydantic schema (`schema.py`) and validator (`validate.py`).<br>• Authored property-based test suites P1–P13 and fixed the P1 generator flake.<br>• Specified Task 13 (Saved Diagrams). *(Credits paused during Task 13; Kiro did not build the Lab redesign).* | `.kiro/specs/`<br>`.kiro/steering/`<br>`.kiro/hooks/`<br>`frontend/src/core/`<br>`docs/kiro-evidence/` |
| **Antigravity** (agy) | **Lab Redesign, Secondary Core, Drivers & Polish:**<br>• Built the complete Frankenstein Laboratory redesign across parallel lanes (tokens, fonts, brand SVGs, i18n, screens, HUD, previews, PWA precaching).<br>• Built Teacher Correct mode (`core/correct.ts`, `screens/Correct.tsx`, `POST /api/v1/validate`, P16/P17).<br>• Completed Saved Diagrams (`core/savedDiagrams.ts`, P14/P15 suites, IndexedDB driver).<br>• Built browser drivers, screen flows, PDF first-page extraction, and Explore screen with relative cursor.<br>• Implemented backend vision providers (`Gemini`, `OpenAI`, `Nebius`), OpenCV Raw Mode (`raw_mode.py`), and Ask pipeline (`ask.py`). | `docs/BUILD_LOG.md`<br>`frontend/src/`<br>`backend/app/`<br>`docs/reports/` |
| **Claude Code** (Anthropic) | **Supervision, Orchestration, Review & Integration:**<br>• Supervised all development lanes, authored briefs in `docs/briefs/`, and reviewed all diffs in `docs/reviews/`.<br>• Launched and monitored agy runs via permission-safe runner (`scripts/agy-run.sh`).<br>• Resolved merge conflicts and captured automated headless Brave screenshots.<br>• Verified production builds and live deployments on Vercel and Render. | `docs/briefs/`<br>`docs/reviews/`<br>`scripts/agy-run.sh`<br>`scripts/setup-dev.ps1` |

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
| `OPENAI_API_KEY` | Backend | OpenAI primary vision API key |
| `GEMINI_API_KEY` | Backend | Google Gemini fallback vision API key |
| `NEBIUS_API_KEY` | Backend | Nebius Token Factory fallback vision API key |
| `VISION_PROVIDERS` | Backend | Provider fallback order (`openai,gemini,nebius`) |
| `GEMINI_MODEL` | Backend | Model name (default: `gemini-3.5-flash-lite`) |
| `GEMINI_THINKING` | Backend | Thinking level budget (default: `minimal`) |
| `ALLOWED_ORIGINS` | Backend | CORS allowed frontend URLs |
| `VITE_API_URL` | Frontend | Backend API endpoint URL |

## Tests

Current test suite status: **1203 frontend tests across 82 files** and **422 backend tests** pass cleanly.

```bash
# Frontend: Vitest and fast-check property tests (1203 tests in 82 files)
npm --prefix frontend test
npm --prefix frontend exec -- tsc -p frontend --noEmit
npm --prefix frontend run build

# Backend: pytest and Hypothesis property tests (422 tests)
backend/.venv/Scripts/python -m pytest backend
backend/.venv/Scripts/python -m ruff check backend
backend/.venv/Scripts/python -m ruff format --check backend
```

## Status and honest limitations

- **Not yet phone-tested:** Automated test suites and browser emulation pass cleanly, but physical vibration motor strength and live TalkBack drag tracking have not yet been tested on an actual phone by the owner.
- **Machine-translated Hindi and Gujarati:** Interface text and speech synthesis support English, Hindi (`hi`), and Gujarati (`gu`); Hindi and Gujarati translations are machine-translated and have not yet been reviewed by native speakers.
- **AI fallback to Raw Mode on free tier:** The Render backend free tier spins down on idle (~30s cold start). If upstream vision providers time out or encounter rate limits, the backend drops into OpenCV edge detection (Raw Mode) so students can still feel the outlines.
- **Android only:** The application targets Android Chrome because iOS Safari does not support the Web Vibration API.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for production deployment instructions on Render and Vercel.

## License

MIT
