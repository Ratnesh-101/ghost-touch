# B-focus: Ask error focus failure (host.guide.spec.ts:55 and :76)

## Symptom
`expect(#gt-ask-input).toBeFocused()` received "inactive" after clicking Ask, on both projects. The
`error-context.md` snapshot shows the input mounted and visible, so the box opened but never had focus.

## Evidence
- The failure counter is wired: `flow/ask.ts` `askErrorMessage` calls `hostFlows.ask.errorLine`, which
  counts the failure in `flow/host.ts` before choosing the joke (53.6). Not the cause.
- The source did try to move focus: `Explore.tsx` `openTextFallback` sets `focusInputAfterAskRef`, and
  the `finally` block calls `setIsBusy(false)` then `setTimeout(() => textInputRef.current?.focus(), 0)`.
- The input is rendered with `disabled={isBusy}`. A disabled input cannot take focus. The timeout can
  fire before React commits `isBusy = false` (and before the box mounts), so `focus()` was a no-op.
  The same race applied to the focus return in `handleTextSubmit` after a failed typed question.

## Verdict
Source bug, not a test bug. The tests state what 53.5 and 53.6 require, so they are unchanged.

## Fix (`frontend/src/screens/Explore.tsx` only)
- Added `pendingInputFocusRef` and a `useEffect` (no deps) that focuses the input once it exists and is
  not disabled, then clears the flag.
- `openTextFallback` and the failed-typed-ask path set the flag. The old timeout stays as a fast path.

## Results
- `npx tsc --noEmit`: no output (clean).
- `npx playwright test e2e/host.guide.spec.ts --reporter=line`: 8 passed (both projects).
- Vitest was not run: no file under `frontend/tests/` was touched.

## Not verified
Real TalkBack focus behaviour on a phone. Playwright proves `document.activeElement` only.
