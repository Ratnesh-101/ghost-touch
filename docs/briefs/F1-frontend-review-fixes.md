# F1 — Fix the frontend review findings (T06b + T07)

Builder: Antigravity | Reviewer: Claude Code | Source: `docs/reviews/T06b-T07-review.md` (read it first, all 16 findings and the DoD section).
Read first: `AGENTS.md`, `docs/handoffs/KIRO-PAUSE.md`, `docs/briefs/T07-explore.md`, `docs/briefs/T06b-pdf-upload.md`. You own `frontend/**` only (never `backend/**`, `research/**`, `docs/reviews/**`).

## Fix these (numbers are the review's finding numbers)
1. **Stale history entry.** Leaving Explore by the on-screen Back button or the two-finger swipe must also consume the history entry that Explore pushed, so the next Android Back / TalkBack Back does the right thing (not "nothing", then leave twice). Give `drivers/navigation.ts` a way to pop the entry it pushed when leaving by another path (`history.back()` once, guarded so the resulting popstate is not treated as a second exit), and guard the push against double effect runs (React StrictMode). Check `history.state` marks the Explore entry so unrelated popstate events (hash changes, forward) are ignored (finding 9).
2. **Centre tick skipped.** Reset the centre-tick state at every new hold (`pointerdown`), as the T07 brief says ("re-centre on each new hold"). Add a test: a hold that ends within the re-arm radius, then a new hold at the centre, must tick again.
3. **Bar tone sticks.** In the TEMP engine stub (`_temp/hapticEngine.stub.ts`), leaving a bar into empty space must send `tone(null)` (design rule 5: leaving all targets silences the tone). Also check the bar branch sets what rule 5 needs. Keep it a straight port: do not tune any value. Add tests. Also give `pitchForValue` a guard for a zero or negative max, and take the hit radii from the config instead of duplicating 22 and 14 (finding 14).
4. **PDF resolution.** Render the first page at a scale so the longest side is about 1600 px (the brief), not at 72 dpi. Add a test that fails if the scale is 1 for an A4-size page. Also: pass the abort signal into `renderFirstPage` so a cancelled upload stops rendering, call `page.cleanup()`/destroy in `finally`, accept an empty MIME type when the file name ends in `.pdf`, and fix the stale comment at the top of `camera.ts` (finding 15). A render timeout of 30 s with a spoken message is welcome.
5. **Stale viewport.** Recompute the canvas size and viewport with a `ResizeObserver` on the canvas element (and keep the window resize), not only on `window.resize`.
7. **Axis crossing.** Reset the axis tracking state on every `pointerdown`, and add hysteresis (a small dead band around the axis, a few pixels) so jitter on an axis does not repeat the speech.
8. **Weak tests.** Replace tests that pass for the wrong reason: the popstate/Back exit tests must exercise the real navigation driver and the real exit handler (not a local closure); add tests that `pointercancel` and `lostpointercapture` lift (stop vibration and tone, reset state); add the centre-tick re-arm test from item 2. Prefer small pure functions you can test without a DOM library.
10. **Swipe exit** must fire once (a `leaving` guard), and clear the active pointers.
11. A second finger landing mid-drag must not reset the engine or the quiet window or fire the centre tick (only the first pointer drives the engine; extra pointers feed the two-finger detectors).
12. Redrawing everything on every `pointermove` (shadow blur) can add jank on a budget phone. Draw the static scene to an offscreen canvas once per resize and only redraw the cursor layer per move, or throttle the redraw with `requestAnimationFrame`. Haptics must never wait for drawing.
13. Debug strings must go through `t()` (add keys); remove the unused keys.

## Do NOT change (needs the owner's phone or approval)
- Finding 6 (possible double reading when focus lands on the canvas): do not change the focus or the label; just note in your report what you left as is.
- Haptic values, the centre-tick pattern (25 ms) and the exit design.

## Rules and checks
No new dependencies. No `any`, no `console.log`. Do not edit Kiro-owned files (`frontend/src/core/**`, `*.prop.test.ts`, `frontend/src/types/scene.gen.ts`, `.kiro/**`). No git commands that change state. Never open or print any environment-variable file. From `frontend/`: `npx tsc --noEmit`, `npm test` (three runs; the Kiro-owned P1 flake may fail once, rerun), `npm run build`. Report real results. Write `docs/handoffs/F1-report.md` last, with the BUILD_LOG text at the end (do not edit `docs/BUILD_LOG.md`).
