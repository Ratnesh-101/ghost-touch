# Contributing to Ghost Touch

Ghost Touch lets blind and low-vision students feel STEM diagrams on an Android phone. We welcome contributions from developers, accessibility advocates, educators, students, and translators!

Before you start, please review our [Code of Conduct](CODE_OF_CONDUCT.md) and technical architecture documents in `.kiro/steering/` (product, tech, structure).

---

## Human Contributors vs. Autonomous AI Agents

Ghost Touch was developed using a multi-agent methodology alongside human developers. To keep contributions clear and maintainable:

* **Human Contributors:** You are warmly encouraged to fork the repository, open GitHub Issues, propose features, submit bug fixes, and open Pull Requests. Describe your changes, reasoning, and test results in your PR description. You do **not** need to log entries in `docs/BUILD_LOG.md`, nor are you restricted from making normal git commits on your fork.
* **Autonomous AI Agents:** Automated builder tools and AI subagents operating within this repository must adhere to the strict operational rules and safety boundaries defined in [`AGENTS.md`](AGENTS.md) (e.g., restricted write directories, temporary stub registers, no unrequested commits/pushes, and mandatory logging in `docs/BUILD_LOG.md`).

---

## Development Setup

### Frontend (Node.js 22+, React 19, Vite PWA)

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

The frontend development server starts at `http://localhost:5173`.

### Backend (Python 3.11+, FastAPI)

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

**macOS / Linux (Bash):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Copy `backend/.env.example` to `backend/.env` and fill in your development keys if testing cloud vision providers. See `backend/README.md` and `docs/DEPLOY.md`.

---

## Local Verification Gates

Every Pull Request must pass all automated CI gates defined in `.github/workflows/ci.yml`. Run these commands locally before submitting your PR:

1. **TypeScript Typecheck (`tsc`):**
   ```bash
   npm --prefix frontend exec -- tsc -p frontend --noEmit
   ```
   Ensures zero type errors across the React application, core geometry, and driver boundaries.

2. **Frontend Unit & Property Tests (`vitest`):**
   ```bash
   npm --prefix frontend test
   ```
   Executes the Vitest suite, including pure core unit tests and `fast-check` mathematical property oracles.

3. **End-to-End Phone Emulation Suite (`playwright`):**
   ```bash
   npx playwright test
   ```
   Tests mobile touch interactions, coordinate letterboxing, 200% font scaling, and screen reader announcements across emulated Galaxy mobile viewports.

4. **Backend Test Suite (`pytest`):**
   ```bash
   cd backend && pytest
   ```
   Runs FastAPI route tests, JSON schema validation, vision fallbacks, and Hypothesis property tests.

5. **Backend Linting & Formatting Check:**
   ```bash
   cd backend && ruff check . && ruff format --check .
   ```

6. **Schema Drift Check:**
   ```bash
   python -m app.export_schema && npm --prefix frontend run gen:types
   ```
   Ensures the frontend TypeScript types in `frontend/src/types/scene.gen.ts` strictly match the backend Pydantic schema in `backend/app/schema.py`.

---

## Architecture & Code Ownership

* **Pure Core (`frontend/src/core/**`):** Contains pure geometric algorithms, coordinate normalization (`[0, 1]` space), hit-testing, and haptic/pitch sequencing. Core contains **no DOM references and no browser APIs**. While autonomous AI agents were restricted from modifying `core/` during hackathon sprints, **human contributors** are welcome to propose enhancements, optimizations, and new mathematical shapes via GitHub Issues and collaborative PRs.
* **Browser Drivers (`frontend/src/drivers/**`):** Thin wrappers that isolate browser and device hardware APIs (`navigator.vibrate`, Web Audio API, Web Speech API, Camera, IndexedDB). All hardware and browser calls belong exclusively here.
* **Accessibility Standards:**
  * Every interactive touch target must be at least **48×48 CSS px**.
  * Every user-facing text and speech string must pass through `t()` for localization.
  * Every state transition must be spoken aloud and reflected in ARIA live regions.
  * Do not change the empirically calibrated haptic timings and frequencies documented in `.kiro/steering/tech.md`.
  * No `any`, and no lingering `console.log` or `print()` statements.

---

## Security & Secrets

* **Never commit secrets:** Never commit API keys, tokens, or `.env` files. Keys must come from environment variables. Only `.env.example` is committed.
* See `docs/SECURITY_RUNBOOK.md` for operational security guardrails, key rotation, and vulnerability response.

---

## Adding New Diagram Scenes

Teachers and contributors can contribute vetted STEM diagram samples:
* Follow the guide in [`docs/TEACHER_GUIDE.md`](docs/TEACHER_GUIDE.md).
* Pre-packaged offline samples reside in `frontend/public/samples/`. All scene coordinates must be normalized to $[0, 1] \times [0, 1]$ and validate against `backend/scene.schema.json`.

---

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`: `git checkout -b feature/my-new-feature`.
2. Implement your changes and write unit, property, or accessibility tests.
3. Run and pass all verification gates: `tsc`, `vitest`, `playwright`, and `pytest`.
4. Commit your changes with clear, descriptive commit messages.
5. Push to your fork and open a Pull Request against `main`.
6. Maintainers will review your PR against accessibility, security, and verification standards.
