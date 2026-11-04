# Ghost Touch 👻

[![CI](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/codeql.yml)
[![Gitleaks](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/Ratnesh-101/ghost-touch/actions/workflows/gitleaks.yml)

Feel diagrams you can't see. Ghost Touch turns a photo of a STEM diagram into something blind and low-vision students can explore by touch on an ordinary Android phone: lines vibrate, corners pulse, labels speak, and graphs sing through a theremin.

Built for **Kiroween 2026 (Frankenstein)** and **STEMergent Hacks 2026**.

## Status
In build. The spec lives in `.kiro/specs/ghost-touch/` (requirements, design, tasks). The monorepo is scaffolded (Task 1).

## Project structure
```
ghost-touch/
├── .kiro/            # specs, steering, hooks — must stay committed
├── frontend/         # React 18 + Vite + TS (strict), PWA, Vitest + fast-check
├── backend/          # FastAPI + Pydantic v2, pytest + Hypothesis, ruff
├── prototypes/       # haptics spike
├── docs/             # build log, demo script, write-ups
├── LICENSE           # MIT
└── README.md
```

## Local setup
After a fresh clone or a Windows reinstall, install Node 20+ (LTS), Python 3.11 and Git, then run one command from the repo root:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
```
It is idempotent: it runs `npm ci`, creates `backend\.venv` and installs `.[dev]`, copies `backend\.env.example` to `backend\.env` and creates `frontend\.env.local` (only if missing, never overwritten), regenerates the schema and TypeScript types, creates `.claude\settings.local.json` and `logs\agy\`, then runs tsc, tests, build, pytest and ruff. You fill in the API keys in `backend\.env` yourself.

## Development
Frontend (Chrome on Android is the target runtime — vibration and camera need HTTPS on a phone):
```bash
cd frontend
npm install
npm run dev          # dev server
npm test             # vitest run
npm run build        # tsc --noEmit && vite build
```

Backend:
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000        # /api/v1/health -> {"ok": true}
pytest
```

## Prototype
`prototypes/haptics-test.html` is the haptics spike used to validate vibration patterns on a real device (Chrome on Android). Open it over HTTPS on an Android phone.

## License
MIT
