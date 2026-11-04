# Ghost Touch 👻

[![CI](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml)
[![Gitleaks](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml)

Ghost Touch turns photos of STEM diagrams into tactile graphics that blind and low-vision students explore by touch on an ordinary Android phone. An AI vision pipeline extracts geometric shapes, axes, curves, and labels into a normalized JSON scene, falling back to local edge detection if providers fail. The web shell translates touch gestures into real-time vibrations, theremin pitch variations, and spoken labels so students can perceive visual diagrams without sight.

## How it feels

- **Lines vibrate:** Tracing a line buzzes continuously at 80 ms pulses every 70 ms.
- **Corners pulse and speak:** Vertices trigger a distinct [50, 90, 50] ms double-tap pattern and speak point labels.
- **Graphs sing:** Tracing curves plays a theremin tone (200–1000 Hz) that rises with visual height.
- **Ask by voice:** Two-finger long press opens speech input; AI answers diagram questions in two spoken sentences.
- **Raw Mode:** OpenCV edge detection provides a tactile fallback when no AI provider answers (it runs on the backend, so the app still needs to reach the server).
- **TalkBack works:** Operates with Android screen readers using accessible buttons and double-tap-and-hold relative exploration.

## Architecture

```text
Photo / PDF ──> Vision Chain (Gemini ──> OpenAI ──> Nebius ──> Raw Mode)
                     │
                     ▼
             DiagramScene JSON (Normalized [0, 1])
                     │
                     ▼
           Pure Core (geometry, hitTest, hapticEngine, pitch)
                     │
                     ▼
     Drivers (haptics, audio/theremin, speech, camera, pdf, audioElement)
```

## Project structure

```text
ghost-touch/
├── .github/          # CI, CodeQL, Gitleaks and other workflows, Dependabot config
├── .kiro/            # Specs (ghost-touch), steering, agent guidelines
├── backend/          # FastAPI + Pydantic v2, vision pipeline, OpenCV edge detection, pytest
├── frontend/         # React 18 + Vite + TS (strict), PWA, core geometry/haptics, Vitest
├── prototypes/       # haptics-test.html device spike
├── research/         # Vision spike benchmarking, ground truth scoring, and test scripts
├── scripts/          # setup-dev.ps1, agy-run runner scripts, allowlist settings
├── docs/             # Briefs, handoffs, reviews, test kits, BUILD_LOG.md, DEPLOY.md
└── README.md
```

## Local setup

Run the idempotent setup script from repo root (installs packages, sets env defaults, runs tests):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
```

Manual commands:
```bash
# Frontend (React 18 + Vite PWA)
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
| `GEMINI_API_KEY` | Backend | Google Gemini primary vision API key |
| `OPENAI_API_KEY` | Backend | OpenAI fallback vision API key |
| `NEBIUS_API_KEY` | Backend | Nebius Token Factory fallback vision API key |
| `VISION_PROVIDERS` | Backend | Provider fallback order (`gemini,openai,nebius`) |
| `GEMINI_MODEL` | Backend | Model name (code default: `gemini-3.5-flash-lite`; `render.yaml` sets the same) |
| `GEMINI_THINKING` | Backend | Thinking level budget (default: `minimal`) |
| `ALLOWED_ORIGINS` | Backend | CORS allowed frontend URLs |
| `VITE_API_URL` | Frontend | Backend API endpoint URL |

## Tests

As of 2026-11-04, 313 frontend tests and 337 backend tests pass.

```bash
# Frontend: unit and fast-check property tests (313 tests)
npm --prefix frontend test
npm --prefix frontend exec -- tsc -p frontend --noEmit
npm --prefix frontend run build

# Backend: pytest and Hypothesis property tests (337 tests)
backend/.venv/Scripts/python -m pytest backend
backend/.venv/Scripts/python -m ruff check backend
backend/.venv/Scripts/python -m ruff format --check backend
```

## Haptic vocabulary

| Meaning | Pattern | Notes |
|---|---|---|
| On a line | `vibrate(80)` re-triggered every 70 ms while the finger stays on the line | feels continuous |
| Leaving a line | `vibrate(0)` | unless a corner pulse is playing |
| Vertex / corner | `vibrate([50, 90, 50])`, then 450 ms quiet window with no line buzz | felt as "bzzzz-tap" on the test device |
| Label / point of interest | corner pattern + spoken label | speech is cancelled and replaced on each new target |
| Graph curve | line buzz + theremin tone, 200–1000 Hz, higher on screen = higher pitch | |
| Centre reference tick (proposed, pending approval) | `vibrate(25)` | one 25 ms pulse, distinct from line and corner patterns; fires on hold start at centre |

Hit radii: vertex 22 CSS px, line 14 CSS px. Vertex hits take priority over line hits.

## Multi-agent roles

- **Kiro:** Monorepo scaffolding, pure core engine (`core/`), property-based tests, and schema specifications (see [docs/KIRO_WRITEUP.md](docs/KIRO_WRITEUP.md)).
- **Antigravity (agy):** Browser drivers, screen flows, Raw Mode edge fallback, PDF renderer, UI polish, and resilience lanes (see [docs/BUILD_LOG.md](docs/BUILD_LOG.md)).
- **Claude Code:** Architectural planning, test harnesses, vision benchmark scoring, independent code reviews and merges.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for Render (backend) and Vercel (frontend PWA) deployment guides.

## Status

- **Built:** Complete monorepo, vision provider chain (Gemini, OpenAI, Nebius), OpenCV Raw Mode fallback, pure geometry and haptic state engine, Web Audio theremin, speech synthesis and voice ask, PWA offline caching, PDF first-page extraction, and 650 automated tests (313 frontend, 337 backend).
- **Untested on a real phone:** TalkBack double-tap-and-hold relative cursor tracking during live exploration, speech recognition accuracy in noisy classrooms, Svara audio slot assets (placeholder only), and physical vibration strength across diverse Android handsets.

## License

MIT
