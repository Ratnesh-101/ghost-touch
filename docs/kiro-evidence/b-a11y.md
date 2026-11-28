# Lane B-a11y: A2-01 to A2-06

Tool: Kiro. Static and jsdom checks only; nothing was run in TalkBack or on a phone.

| ID | Change |
|---|---|
| A2-01 | `LabSettings.tsx`: the Tab trap ignores controls inside a `[hidden]` ancestor. |
| A2-02 | `Correct.tsx`: picker names no longer say "Selected ..." (`aria-pressed` carries the state). Points use `vertex.unnamed` ("Corner: A (A)"), lines use `line.unnamed`; curves and bars show their label only. |
| A2-03 | `Teach.tsx`, `teach.css`: element list of named toggle buttons (points and edges) that calls the same `handleSelect` as a canvas tap, so "Add edge" works without a pointer. |
| A2-04 | `Build.tsx`: status uses `StatusText` (no live region while the app speaks). |
| A2-05 | `SavedDiagrams.tsx`: Delete moves focus to Confirm, Cancel returns it to that entry's Delete. |
| A2-06 | `Build.tsx`: form is a `<main>` inside the unchanged root `div`, heading has `tabIndex=-1` and is focused on mount, `build.title` spoken once, focus returns to Feel when Feel closes. |

Tests: new `frontend/tests/semantics.a11y.test.tsx` (9 tests).

## Edits outside the lane's file list (needed because the old assertions encoded the old behaviour)
- `tests/build.status.test.tsx`: the 0-pin test no longer expects `aria-live="polite"` when speech is available.
- `tests/correctCurvesBars.test.ts`: curve and bar names without "Selected ...".

## Needs from other lanes
- B-host (`i18n/index.ts`, spec): no spec change was made (the spec files are B-host's). Neutral nouns for curve and bar picker names and a Teach element-list group name are missing. The Teach list is named with `teach.loadCurrent` ("Current diagram") as a stand-in; add dedicated keys (en, hi, gu) and swap them in.
- Hindi/Gujarati parity: the Correct parity test in `a11y.screens.test.tsx` needs a translated noun, which is why points and lines reuse `vertex.unnamed` and `line.unnamed`.

## Results
`npx tsc --noEmit`: 0 errors. `npx vitest run`: 265 files passed, 3392 tests passed, 1 todo, 0 failed (`b-a11y-vitest.txt`, `b-a11y-tsc.txt`).
