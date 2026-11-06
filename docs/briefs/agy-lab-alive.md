# Lane lab-alive: the "IT'S ALIVE" moment when a diagram finishes loading

Read `docs/briefs/lab-spec.md` (the Motion paragraph) first. The pieces exist already: `components/lab/Spark.tsx` (one-shot spark arc plus glow pulse with an `onDone` callback and a static final frame under reduced motion), the lab tokens, the framed Explore screen (`screens/Explore.tsx`, `styles/explore.css`). The `success` earcon is ALREADY played by the Capture flow when a scene is ready: do not add, change or duplicate any audio.

## Allowed files
`frontend/src/screens/Explore.tsx` (add the spark moment as wrapper markup and one small state; no change to the canvas, handlers, effects, speech or haptics), `frontend/src/styles/explore.css`, `frontend/src/components/lab/Spark.tsx` and `frontend/src/styles/lab.css` ONLY if a small adjustment is needed, new `frontend/tests/alive.lab.test.tsx`, `docs/reports/agy-lab-alive-report.md`.

## Forbidden
The canvas element, its pointer handlers, `touch-action`, hit-testing, haptic and effect calls, speech and earcon calls and all `drivers/**`, `flow/**`, `core/**`, `i18n/**`, `Capture.tsx`, `App.tsx`, backend, `.env*`, prop tests.

## Do
1. On entering Explore with a freshly loaded scene, play the spark once around the specimen-table FRAME and HUD chip (a brief arc across the top edge of the frame plus a green glow pulse on the frame border), never over the drawing area and never as an overlay that intercepts pointer events (`pointer-events: none`, below the canvas in stacking order or outside its box). The whole moment lasts under 1.2 s, flashes no more than 3 times per second in total, and ends in the normal resting frame.
2. `prefers-reduced-motion: reduce`: no animation at all, just the resting frame (add it to the reduced-motion handling and keep `tests/a11y.motion.test.ts` passing).
3. It plays once per scene load, not on every re-render and not when returning from Correct or Ask (use a keyed state or a ref; read how `Explore` receives `scene` and `announced`). It must not delay the first touch: the canvas accepts input immediately, haptics and speech are unaffected.
4. `aria-hidden` on everything decorative; no new live region, no text.
5. Tests: the spark markup is `aria-hidden` and `pointer-events: none`; it renders once for a new scene and not again on a re-render with the same scene; reduced motion CSS disables it; total animation duration declared in the CSS is at most 1.2 s (parse the durations and delays); no keyframe cycle flashes faster than 3 Hz.
6. Colours only from tokens. After the change run the build and confirm your rules exist in `frontend/dist/assets/index-*.css`.

## Done
`npm --prefix frontend exec -- tsc -p frontend --noEmit`, `npm --prefix frontend test` (all old tests pass, plus yours, real counts), `npm --prefix frontend run build` pass. Run NO backend commands. Report with the `Explore.tsx` diff stat (should be wrapper markup and one state only) and **Commit groups**; write the report even if something failed.
