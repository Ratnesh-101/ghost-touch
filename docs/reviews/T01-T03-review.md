# T01–T03 review
Reviewer: Claude Code (Kiro paused) | Date: 2026-10-31 | Verdict: **T1 SHIP · T2 SHIP with follow-ups · T3 FIX FIRST (bar edges)**

Commands run: frontend `npm test` (44 pass, 5 files), `tsc --noEmit` (clean), `npm run build` (OK); backend `pytest` (58 pass), `ruff check` (clean), live `uvicorn` health (`{"ok":true}`); regenerated `scene.gen.ts` (no drift); sample JSON equals fixture factories.

## Findings
| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| 1 | High | `frontend/src/core/hitTest.ts:131-187,25` | Bar edges are never hit-tested (`design.md:54`, Req 6.3). Just outside a bar within 14 px gives `none`. | Add each bar's four edges as lines with `elementKind: 'bar'`; test edge, interior, edge-beats-interior. |
| 2 | Medium | `backend/app/schema.py:60`, `types/scene.gen.ts` | `Polyline.points` tuple generates `[unknown, unknown][]`. | Use `items`-style type, regenerate. |
| 3 | Medium | `frontend/src/core/scene.ts:32-56` | Hand-written duplicate of `DiagramScene`/`Polyline` (tech.md rule 3). | Remove after #2. |
| 4 | Medium | `scene.gen.ts` | `[k: string]: unknown` on every interface. | `extra="forbid"` or generator option. |
| 5 | Medium | `schema.py`, `export_schema.py:19-22` | Range not in JSON schema; docstring claims it is. | `Field(ge=0, le=1)` or fix docstring. |
| 6 | Medium | `frontend/package.json` `test:prop` | Finds no tests, exits 1. | `vitest run .prop.test`; also fix CLAUDE.md:98. |
| 7 | Medium | `backend/fixtures/sine.py` | 25 points over 2 periods; spec says about 100 over one. Pitch will step. | About 100 points, update the fact. |
| 8 | Low | `backend/` | `ruff format --check` fails on 2 files. | `ruff format .` |
| 9 | Low | `tests/test_export_schema.py:151` | Drift test skips when `scene.schema.json` is absent (gitignored). | Generate in a fixture or commit the file. |
| 10 | Low | `hitTest.ts:205` | Inverted bars can never be hit. | Reject in `validate.py`. |
| 11 | Low | `hitTest.ts:234` | Rebuilds the point `Map` every call. | Precompute if the phone stutters. |
| 12 | Low | `geometry.prop.test.ts`, `hitTest.prop.test.ts` | `fc.float` is 32-bit. | `fc.double`. |
| 13 | Low | `docs/BUILD_LOG.md` | No entries for T2 or T3. | Kiro adds on return. |
| 14 | Info | `fixtures/triangle.py` | Right angle at C follows `design.md`; the CLAUDE.md Task 9 check ("AB = 3 cm") and the research ground truth (right angle at B) differ. | Use "5 centimetres" for the fixture; don't mix sets in the demo. |

## DoD check
- [x] T1: `npm test` and `pytest` run; `/api/v1/health` returns `{"ok": true}`; PWA manifest name and theme correct.
- [x] T2: fixtures validate against the Pydantic model in tests; samples exist in `frontend/public/samples/`.
- [x] T3.1 and T3.2 behave as specified except bar edges (finding 1).
- [x] 3.3 P8: 200 runs, passes. 3.4 P1: `hitTest.prop.test.ts` present, 200 runs, passes (box still `[ ]`).
- [ ] 3.5 P2: not written.

## Needs from Kiro (core changes)
Findings 1, 2–5, 7, 10, plus P2. Tracked in `docs/handoffs/KIRO-PAUSE.md`.
