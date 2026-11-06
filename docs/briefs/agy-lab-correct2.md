# Lane lab-correct2: fix the Correct canvas and the Saved/Correct layout and focus bugs

Read `docs/reports/audit-layout.md` (sections 2.4, 2.5 and 6: BUG-02, BUG-05, BUG-06, BUG-07) and the shared bug audit at `../gt-lane-audit/docs/reports/audit-bugs.md` (findings 7, 8 and 17; open it by that relative path, or work from the descriptions here). The Saved and Correct screens were restyled by a previous lane (now in `main`).

## Findings to fix
- BUG-02 / finding 7 (CRITICAL): in `screens/Correct.tsx` the `<canvas>` bitmap is hard-coded to 600x400 and shown with CSS `object-fit: contain`, while hit-testing converts the pointer position assuming the canvas fills its CSS box, so points cannot be grabbed or dragged accurately near the edges and on phones. Fix by sizing the canvas bitmap to its real CSS box (`ResizeObserver`, device pixel ratio), using the SAME letterboxed `Viewport` (`makeViewport`) for drawing and for converting pointer coordinates to scene coordinates. Put the pointer-to-scene conversion in a small PURE function in a new file `frontend/src/flow/correctCanvas.ts` (inputs: client x and y, the bounding rect, the bitmap size and dpr, the viewport; output: scene point) so it can be unit tested with edge cases (letterboxed wide and tall boxes, dpr 1 to 3, points on the border).
- BUG-05: `.gt-saved__header` must wrap (`flex-wrap: wrap`, keep the gap) so the heading and Back button never collide at 320 px or 200 percent zoom. BUG-06: safe-area padding (`env(safe-area-inset-*)`) on the Saved and Correct containers. BUG-07: `.gt-correct__canvas-container` must not force `min-height: 280px` in landscape: use `clamp(160px, 40vh, 280px)` and a landscape rule.
- Finding 8 (MEDIUM): focus is lost on mount in Correct and SavedDiagrams: move focus to the screen heading (make it `tabIndex={-1}` and focus it in a mount effect) so TalkBack announces the screen, WITHOUT changing the spoken messages (the screens already speak on entry; this is only keyboard and screen-reader focus placement).
- Finding 17 (LOW): a PDF blob must not be passed to the photo overlay in Correct as if it were an image; guard it so Correct loads the overlay only for image blobs and otherwise shows no overlay.

## Allowed files
`frontend/src/screens/Correct.tsx`, `frontend/src/screens/SavedDiagrams.tsx` (focus effect only), `frontend/src/flow/correctCanvas.ts` (new), `frontend/src/styles/saved.css`, `frontend/src/styles/correct.css`, tests: new `frontend/tests/correct.canvas.test.ts`, `frontend/tests/saved.focus.test.tsx`, and extend `tests/correct.lab.test.tsx` and `tests/saved.lab.test.tsx` (never weaken an assertion; existing `tests/correct.*.test.ts` and `tests/saved.*.test.ts` must pass unchanged), `docs/reports/agy-lab-correct2-report.md`.

## Forbidden
`core/**` (you may import from it), `drivers/**`, `i18n/**`, the Explore screen, haptics, speech and earcon calls, other CSS files, backend, `.env*`, prop tests. Do not change any spoken string or what the Correct flow does (`flow/correct.ts` logic stays as is; only the canvas sizing and coordinate conversion change).

## Do
Test first for each bug, then fix. For BUG-02 include tests that a pointer at each corner and edge of the drawn diagram maps to the right scene point for several box shapes and dpr values, and that drawing and hit-testing use the same viewport object.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass; confirm the new CSS rules exist in `frontend/dist/assets/index-*.css`. Run NO backend commands. Report with the diff stat and **Commit groups**; write it even if something failed.
