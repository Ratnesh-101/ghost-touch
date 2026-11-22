# Opus review: Playwright coverage of Help (Req 50) and highlight (Req 49)

Date: 2026-11-22. Reviewer: Claude Code (Opus). Method: read the three specs, `playwright.config.ts`, `Explore.tsx`, `explore.css`, `core/help.ts`, `core/highlight.ts`, Requirements 49 and 50, then ran throw-away experiments in an untracked scratch spec on the 384x832 dpr3 project (deleted afterwards). No tracked file changed.

**Verdict: fix first. The 28 green tests hide one real Help bug (it can't be tapped while a finger is on the diagram) and one real visual bug (the Help text is cut off in the status line). Highlight behaviour is correct in every case I tried.**

## Findings

1. **High: Help does nothing when tapped with a second finger while the first finger holds the canvas (breaks Req 50.5).**
   Evidence: scratch test, CDP `touchStart [B]`, then `touchStart [B, Help centre]`, then `touchEnd`. The Help button got `pointerdown` and `pointerup` but **no `click`**. The status line stayed "Right Triangle ABC…" and no utterance was recorded. Control test: a single-finger tap on Help fires `click` and speaks. Chromium sends no click for a tap that is part of a multi-touch sequence, and `Explore.tsx:2660` listens only to `onClick`. Req 50.5 says Help "works … whether or not a finger is down". Where am I (`Explore.tsx:2643`, Req 30.3) uses the same pattern, so it probably fails the same way (not tested).
   Fix: activate Help and Where am I on `onPointerUp` when `pointerType === 'touch'` and the pointer started on the button, and drop the `click` that may follow (a ~500 ms guard). Keep `onClick` for keyboard and TalkBack. Add an e2e test that does exactly the CDP sequence above and expects the Help text in the status line. Confirm on the phone, because this was seen under emulation.
   Who: agy (screen + e2e).

2. **High: the Help text is clipped in the status line, so low-vision and sighted helpers never see the last sentence (and in Raw Mode they never see the Raw sentence).**
   Evidence: `.gt-explore__status` is `-webkit-line-clamp: 3` inside a card fixed at `height: 5rem` (`explore.css:209,226`). Measured after pressing Help (`scrollHeight` / `clientHeight`): en 384 px **78/59**, en 320 px **98/59**, hi and gu the same, Raw scene 384 px **98/59** with 4 sentences. In Raw Mode the hidden part is "This diagram is only rough outlines…", which is the sentence Req 50.8 exists for. With Guide on there are 5 sentences, so even more is lost. The spec line `help-highlight.spec.ts:53` uses `toContainText`, which reads `textContent` and passes even when the text is clipped.
   Fix (screen): keep Req 25's fixed card height, but let the status scroll inside it: `overflow-y: auto` with the line clamp removed **only while Help text is shown** (a `--help` modifier class), and add `tabIndex={0}` so TalkBack can reach it. Alternative: show the sentences one at a time in step with the speech. Fix (spec): assert `scrollHeight <= clientHeight + 1` for the status after Help, at 320 px and 384 px, in en and Raw.
   Who: agy (CSS/screen + e2e). If the Req 25 wording has to change, that edit is Kiro's.

3. **Medium: the layout spec never checks the Help button. Its "5 action buttons" test now has 6 buttons.**
   Evidence: `explore.actions-layout.spec.ts:159-165` (`buttonSpecs`) lists Back, Where am I, Ask, Correct and Guide me, but **not Help**. The test at `:472` is called "5 action buttons" and injects Guide me, so with Help there are 6 buttons and Help is never measured. Req 50.6 relies on "the existing e2e layout specs still pass", but those specs don't look at Help. `help-highlight.spec.ts:45-46` checks only x, not `y + height <= viewport.height`.
   Fix: add `{ name: 'Help', required: true }` to `buttonSpecs`, rename the test to "6 action buttons", and add the y-bound check to the Help test.
   Who: agy.

4. **Medium: in landscape the whole footer is below the fold. No test notices.**
   Evidence: at 832x384 the Help, Ask, Where am I and Back buttons sit at y 364-419 (viewport 384). The same happens at 915x412 and 640x360. `main.gt-explore` scrolls (`scrollHeight 427 > 384`), so the buttons can be reached, but a blind user has no cue to scroll. The rotation test (`explore.canvas-stable.spec.ts:670-720`) checks only the canvas width. Touch mapping after scrolling `main` is correct (A, B and C all hit, checked).
   Fix: for `(orientation: landscape) and (max-height: 480px)`, put the canvas and the footer side by side, or make the footer a fixed bottom bar. Add an e2e test at 832x384 that asserts every footer button is fully inside the viewport.
   Who: agy.

5. **Medium: no e2e test for Raw Mode, Guide, or the bar and sine highlight, because of how the e2e build is set up.**
   Evidence: `playwright.config.ts:43` builds with only `VITE_FEATURE_SHARE=1`, so `VITE_FEATURE_GUIDE` is off. Help is never e2e-tested with `help.guide`/`help.stop`, and Req 49's rule "no highlight while guiding" (`Explore.tsx:444`) is never exercised. The build also picks up `frontend/.env.local` (`VITE_API_URL=http://localhost:8000`), and the page's CSP blocks that URL ("violates … connect-src 'self' https://ghost-touch-api.onrender.com"). So `page.route` mocks of `/api/v1/scene` never fire. With `bypassCSP: true` plus a routed raw response, I confirmed that Raw Mode works: the Raw notice appears, Help speaks 4 sentences, and the highlight shows `segment:s1` and `polyline:r1`. I also confirmed `bar:q2` (interior and top edge), `polyline:sine_curve` at the peak, and `axis:x-axis` and `axis:y-axis` on both charts.
   Fix: set `VITE_FEATURE_GUIDE: '1'` and `VITE_API_URL: ''` (same-origin) in `webServer.env`, so `.env.local` can't leak in. Then add specs for: Raw scene via `page.route` (Help includes the Raw sentence; highlight on a raw segment); bar and sine highlight using the ids above; Help with Guide on; highlight is `none` while guiding.
   Who: agy.

6. **Medium: no e2e test for the multi-finger highlight rules (Req 49.5 promotion). Plain CDP can't do it.**
   Evidence: CDP `Input.dispatchTouchEvent` can't lift one finger out of two. `touchEnd` must have no points, and a `touchMove` that leaves out id 0 sent no `pointerup` for it (instrumented: only `pointerdown#2`, `pointerdown#3` and `pointermove#3` fired). Using two CDP fingers plus a synthetic `pointerup` for the primary, the promotion works: the highlight goes from `vertex:B` to `segment:BC`. Also checked and correct: a second finger leaves the primary's highlight alone; the two-finger long press opens Ask ("Listening…") with the highlight kept; a two-finger swipe down returns to Capture; lifting all fingers gives `none`.
   Fix: add those four cases to the spec, using CDP for the touch-downs and a dispatched `PointerEvent('pointerup', {pointerId})` for the single-finger lift. Comment that this is a CDP limit.
   Who: agy.

7. **Medium: the highlight test checks only the `data-highlight` attribute, not the pixels.**
   Evidence: `updateHighlightCanvasAttr` runs synchronously in `applyHighlight` (`Explore.tsx:450`), separately from `draw`, so the test would pass even if `renderHighlightElement` drew nothing or never cleared. A pixel probe works: 3.5 CSS px above the middle of BC, the colour is `26,94,53` at rest, `166,255,204` (#a6ffcc) while touching, and `26,94,53` again after lift.
   Fix: add that probe (`getImageData` at a bitmap-scaled point) to the corner/side test, for both "drawn" and "cleared".
   Who: agy.

8. **Low: blur during a hold clears the highlight correctly, but the finger that stays down is then dead.**
   Evidence: `window` `blur` while touching B gives `none` (good, Req 49.5). After that, moving the same finger to BC still gives `none`, with no feedback, until the finger lifts and touches again (`Explore.tsx:1483` clears `activePointers`, and `:2127` ignores non-primary moves). It's intended (GT-04) but not tested and not announced.
   Fix: add an e2e test for "blur → none, fresh touch → segment:BC". Decide (owner) whether a move from an unknown pointer should adopt it as primary.
   Who: agy (test). Owner decides on the behaviour.

9. **Low: fragile parts of `explore.help-highlight.spec.ts`.**
   - `:15` `waitForTimeout(300)` is a fixed sleep. Wait for `data-highlight="none"` and a non-zero canvas box instead.
   - `:52` `help.click()` sends mouse events in a touch project. Use `help.tap()` to match real input.
   - `:80` the title says "Help layout stays stable", but the test never measures Help. Measure the Help box before and during the hold, or rename it.
   - `:25-33` `toPage` copies `makeViewport`. Note in a comment that it must change if `aspect` support is added (Req: scene is a unit square "unless aspect is added later").
   - `playwright.config.ts:47` `reuseExistingServer: true` silently reuses a stale preview on 4173 left by another session, which would test old code. Use `!!process.env.PW_REUSE`.
   Who: agy.

10. **Low: in Gujarati the footer buttons grow from 82 to 109 px tall and the canvas shrinks from 304 to 277 px (384x640).**
   Evidence: "હું ક્યાં છું" wraps to three lines. All layout specs run only in English (`locale: 'en-US'`, no `gt_language` set). The buttons stay at least 48 px and there is no horizontal scroll, so this is not a failure today.
   Fix: run one layout case per language by setting `localStorage.gt_language` in `addInitScript`.
   Who: agy.

## Checked and fine (no action)
Highlight ids for every sample element; clearing on lift, blur, swipe-exit and no-target; mapping in landscape and after scrolling `main`; Help speaks one utterance in the active language (`hi`/`gu` text is correct; the headless browser falls back to an en-US voice by design, `speech.ts:330`); no horizontal scroll at 320 px.

## For the phone
Tap Help with a second finger while one finger rests on the triangle (item 1). Read the status card after Help on a Raw photo (item 2). Rotate to landscape and look for the footer (item 4).
