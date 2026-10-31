# Ghost Touch backend

FastAPI service that turns a photo of a STEM diagram into a validated,
normalized `DiagramScene` for the Ghost Touch frontend.

## Stack
- Python 3.11+ (developed on 3.13), FastAPI, Pydantic v2
- Vision LLM behind a `VisionProvider` interface (model + key from env)
- OpenCV (`opencv-python-headless`) for Raw Mode edge detection
- Tests: pytest + Hypothesis; lint/format: ruff

## Setup
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env        # then fill in GEMINI_API_KEY
```

## Run
Local development:
```bash
uvicorn app.main:app --reload --port 8000
# health:  http://localhost:8000/api/v1/health  ->  {"ok": true}
```

Production run command (used by Render):
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Deploy
Backend deploys to Render via the root `render.yaml` Blueprint.
See `docs/DEPLOY.md` for step-by-step deployment instructions.

## Test
```bash
pytest
ruff check .
```

## Type-generation flow
```
schema.py  ->  python -m app.export_schema  ->  backend/scene.schema.json
           ->  (frontend) npm run gen:types  ->  frontend/src/types/scene.gen.ts
```
Never hand-edit `scene.gen.ts`.

> Scaffold state (Task 1): only the app shell and health route exist. The
> schema, vision pipeline, Raw Mode, validation, and ask routes arrive in
> Tasks 2 and 8–9.
