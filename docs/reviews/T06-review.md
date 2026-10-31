# T06 review
Reviewer: Claude Code subagent | Verdict: FIX FIRST

Code is clean and well structured (flow/ split is testable, timers and abort handled correctly, no Kiro-owned edits, no new deps, no `any`/`console`). Two real-device defects (M1, M2) and three unmet DoD items (phone, TalkBack, Network tab) keep it from SHIP. Note: builder and planner are both Claude Code; this review was done independently from the files, not from the report.

## Findings
| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|
| M1 | Medium | drivers/camera.ts:28-34, flow/capture.ts:58 | The 10 MB cap is applied to every file, including "Take photo", before the image is downscaled. A 50 MP phone photo (Nord CE6 class) is often 8-15 MB, so the main camera path can be refused with "too large" even though it would shrink to roughly 300 KB. Req 2.2 states the 10 MB limit for "Choose image" only. | Apply the size limit only to the Choose image input (pass a flag/`maxBytes`), and for camera capture accept up to a much larger bound (e.g. 40 MB) since it is downscaled before upload. Add a test for each input. |
| M2 | Medium | screens/Capture.tsx:47-50, 78 | `say()` speaks through `speechSynthesis` and also writes the same text into a `role="status"` + `aria-live="polite"` region. With TalkBack running, every message is announced twice (TalkBack live region plus TTS), overlapping and garbled. Not testable without the phone; the report did not check it. | Decide on the phone. Likely fix: keep the status text visible but drop `role`/`aria-live` (speech driver is the announcement channel), or keep the live region and skip `speech.speak` when it is on. Brief says aria-live, so confirm with the user before changing. |
| M3 | Medium | DoD (report lines 28-31) | Unmet DoD items: no browser Network-tab check for samples, no phone run, no TalkBack walk-through, no computed 48 px sizes. Honestly reported, but still open. | User to run on phone/DevTools; add results to the report. |
| L1 | Low | screens/Capture.tsx:56, 67 | `busy` is read from the render closure (stale if two `change` events land before a re-render) and a second file/sample chosen while busy is dropped silently (user hears nothing). `handleSample` never sets `busy`, so a double-tap runs `onScene` twice. | Keep busy in a ref as well; when busy, speak a short "Still reading your diagram"; set busy during sample load or ignore repeat taps. Optionally `disabled`/`aria-disabled` the controls while busy. |
| L2 | Low | screens/Capture.tsx:66-73 | `onScene(...)` is inside the `try`, so an exception from Explore would be reported as "Could not open that sample". No focus restore after a sample error (only after upload errors). | Move `onScene` out of the `try`; focus Take photo on sample failure. |
| L3 | Low | tests/screens.render.test.ts, tests/flow.start.test.ts | Tests would still pass if `Start` stopped calling `speakIntro`/`handleStartTap`, used `pointerdown` instead of `click`, or if Capture ignored `busy`: server-render only checks markup and flow tests call helper functions directly. Touch-target test is a CSS regex, not a computed size. Contrast is not tested. | Acceptable without jsdom (no new deps allowed), but record this as a known gap; verify click/focus behaviour in the phone checklist. |
| L4 | Low | screens/Start.tsx:22-26, screens/Capture.tsx:39-45 | Programmatic `focus()` on mount makes TalkBack announce the control while TTS is speaking the prompt; likely overlap. Unverified. | Check on the phone; if awkward, delay the focus until the prompt ends or drop the auto-focus on Start. |
| L5 | Low | App.tsx:44-47, flow/start.ts:15 | Pressing Back re-speaks the "Vibration is not supported" warning every time on unsupported devices. | Speak the warning only on the first Capture entry. |
| L6 | Low | flow/navigation.ts:20, screens/ExploreStub.tsx:19 | Raw announcement is the exact required sentence followed by the stub hint (prefix is exact; fine). It is spoken but not shown on Explore, so the visible/spoken mirror is broken for raw mode. `scene.kind` is shown/spoken as a machine id (`bar_chart`). | Show the announcement text in the stub status; map kind to a `t()` label. T07 will replace the stub, so low priority. |
| L7 | Low | api/scene.ts:47-51, 65-68 | Scene responses and samples are only checked for a string `kind`; the body is trusted (backend validates). If `VITE_API_URL` is unset in production the POST silently goes to the static host and ends in the generic error. | Fine for now; consider a spoken "server not configured" message and a minimal shape check before T07 consumes the scene. |
| L8 | Low | drivers/camera.ts:30-32 | A file with an empty `type` (some Android pickers, HEIC) is rejected as unsupported type. Acceptable and spoken, but could be sniffed. | Optional: fall back to the file extension when `type === ''`. |
| L9 | Low | scope | Edits outside "Files you own": `components/AccessibleButton.tsx` (ref forwarding, disclosed and sensible) and `vitest.config.ts` (disclosed). `flow/` folder is not in structure.md (disclosed). `research/vision_spike.py`, `docs/briefs/T05/T08*.md`, `AGENTS.md`, `.gitignore` are modified in the tree but are not T06 work. | Update structure.md to list `flow/`; confirm the non-T06 edits are intended. |

## Verified, not defects
- StrictMode abort pattern: the effect creates a fresh `AbortController` each run and `handleFile` reads `lifetime.current` at call time, so after the mount/unmount/remount cycle the signal belongs to the live controller (not the aborted one). The `useRef(new AbortController())` initial value is allocated every render but harmless.
- `input.value = ''` runs after `files[0]` is taken, so the same file can be chosen twice and the File object stays valid.
- Progress timer: started after "Reading" is spoken, cleared in `finally` on success, failure, rejection and abort. No leak found. Prepare step is not abortable (tone may continue a moment after unmount), negligible.
- Start uses `click` (works with TalkBack double-tap); audio unlock, vibrate and the first tap speech all run synchronously inside the click handler.
- 10 MB boundary correct (exactly 10 MB accepted, +1 byte rejected); PDF gets its own spoken reason; transparent PNG is painted on white; EXIF handled via `from-image` with `<img>` fallback.
- Browser APIs: grep shows `navigator|window.|document.|AudioContext|speechSynthesis|SpeechRecognition|createImageBitmap` only under `src/drivers/` plus `main.tsx` (`document.getElementById`, allowed). `fetch`/`FormData`/`AbortController` in `api/scene.ts`: agree, it is a backend client (structure.md assigns it to `api/`), not a device capability.
- No `any`, no `console.*`, every string goes through `t()` (only `scene.title`/`kind` data is shown raw). No new dependencies.
- Contrast: muted text `#9fb3a8` on `#0b0b10` is about 8.9:1; main text and green are higher. All above 7:1.
- Haptic values untouched; `50` ms confirmation matches the brief.

## DoD check
- [x] `npm test` passes: 6 consecutive runs, 14 files, 126 tests, all green (the known `hitTest.prop` flake did not occur).
- [x] `npx tsc --noEmit` clean (exit 0).
- [x] `npm run build` OK (12 precache entries, built in about 0.4 s).
- [x] Unit tests listed in the brief exist and pass: `computeTargetSize` (landscape, portrait, small, exact limit, +1), validator (type, 10 MB boundary), Start speaks on load and on tap and advances, unsupported-vibration path, wait loop stops its timer on success/error/rejection/abort (`vi.getTimerCount() === 0`). Caveat: "advances" and "Capture unmount" are tested at the helper level, not the component (L3).
- [ ] Samples reach ExploreStub with no backend request: code-level only (`loadSample` calls only `/samples/<id>.json`, unit-tested; all three sample files exist in `public/samples`). Not observed in a Network tab.
- [ ] Nord CE6 over HTTPS (tap start, rear camera, upload, airplane-mode sample): not done.
- [ ] TalkBack walk-through: not done.
- [ ] 48 px computed sizes: only CSS rules asserted (`.gt-control` 48 px, Capture buttons 64 px); Start surface is full viewport.
- [x] No Kiro-owned file edited. `git status` shows `frontend/src/core/**`, `backend/app/schema.py`, `validate.py`, `scene.gen.ts` and `.kiro/**` untouched except the two documented pre-existing edits (`hitTest.prop.test.ts`, `tasks.md` 3.4). `vitest.config.ts` and `AccessibleButton.tsx` edits are outside the owned list but disclosed (L9).

## Needs from Kiro (core changes I should make)
- None
