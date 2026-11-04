# Lane B: Graph / model pipeline hardening
## Goal
Fast, cheap, reliable scene extraction. Much already exists on main (backend/app/graphs/{expr,sample,facts,route}.py, scene_cache.py, vision chain). Read them and docs/research/vision-spike.md and docs/briefs/T08b-graph-route.md FIRST, then close the gaps below. Do not rewrite what works.
## Allowed files
backend/app/main.py, backend/app/graphs/**, backend/app/scene_cache.py, backend/app/vision/gemini.py, backend/app/vision/prompts.py, backend/app/vision/chain.py, new/updated EXAMPLE-based tests in backend/tests/ (NOT *_props.py), docs/reports/agy-graph-report.md
## Forbidden
backend/app/schema.py, backend/app/validate.py, test_*_props.py, render.yaml, .env.example, frontend/**, .kiro/**. If an env var or default must change in a forbidden file, list it under "Needs from owner" in your report.
## Do
1. Default Gemini model in code (gemini.py default) -> gemini-3.5-flash-lite for geometry and bar charts (fast, ~2.6 s). Keep GEMINI_MODEL override working.
2. Graphs: confirm the route extracts equation + axis ranges and samples the curve with the SAFE parser (a small hand-written expression parser, never Python eval or exec; add tests that unsupported expressions are rejected: names that are not x or known constants, attribute access, function calls outside a small whitelist (sin, cos, tan, exp, log, sqrt, abs), very long input, huge exponents, division by zero, nan/inf). Fall back to the traced polyline when the equation is missing/unsafe/fails.
3. "Improve" pass: after returning the fast result, optionally run the stronger model (GEMINI_IMPROVE_MODEL, default gemini-3.8-flash) NON-BLOCKING in a background task; if it returns a valid scene, store it in the cache under the same image hash so the next request (or a re-fetch) gets the better scene. Never delay or fail the primary response; never cache failures. Add example tests with fake providers.
4. Cache: keyed by image hash (+prompt/version), validated scenes only, bounded size. Add tests for hit, miss, no-cache-on-failure, eviction.
5. Keep timeouts: SCENE_TIMEOUT_SECONDS 15, Raw Mode floor intact.
## Done
python -m pytest backend, ruff check backend, ruff format --check backend all pass (report real counts). Report lists files touched and "Needs from owner".
Shared rules: read AGENTS.md first. Never edit Kiro-owned files: frontend/src/core/**, any *.prop.test.ts or test_*_props.py, backend/app/schema.py, backend/app/validate.py, frontend/src/types/scene.gen.ts, .kiro/**. Do NOT change the tuned haptic values or the haptic engine (public interface only). No git state changes, no installs, no .env access, no new dependencies. Example-based tests only (property tests belong to Kiro). Every user-facing string through t(). Browser APIs only in frontend/src/drivers/. Run the DoD commands from the allowed list and record real results, including failures. Write your report last.
