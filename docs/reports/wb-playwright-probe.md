# Playwright accessibility probe (emulated phone), 2026-11-28

Tool: Claude Code. Emulated Pixel 7 in Chromium at 390x844, touch on, service workers blocked, against `vite preview` on :4175 (the existing `frontend/dist`, not rebuilt). Speech recognition was removed so Ask falls back to the text box. `speechSynthesis.speak` was spied; a MutationObserver logged live-region text (`aria-live` not off, `role=status|alert|log`). Target check: every visible control at least 47.5 x 47.5 CSS px. When a modal dialog is open, only controls inside it are checked. "200%" means `html { font-size: 200% }`.
Mocked: `/api/v1/ask` (fixed answer) and `/api/v1/scene` (triangle fixture with `mode: "raw", reason: "timeout"`) so Raw Mode could be reached. To turn on teacher tools, `gt_teacher_enabled=true` was seeded in localStorage. This build has the share flag, so Correct and Teach can be reached.
Script: `scratchpad/probe.mjs` (session scratchpad, not in the repo).

## Results per screen

| Screen | Check | Result | Evidence |
|---|---|---|---|
| Settings sheet | names / 48 px | PASS | 12 controls, 0 problems (also at 200%) |
| Settings sheet | overflow 200% | PASS | page 0 px, sheet 0 px |
| Settings sheet | focus on entry | PASS | `Close settings` button |
| Settings sheet | live + speech duplicated | PASS | spoken "Lab settings opened"; no live region |
| Settings sheet | Back / Escape | PASS | Close: "Lab settings closed", focus goes back to the Settings button; Escape closes |
| Settings sheet | next-step line | FAIL (minor) | only "Lab settings opened"; no hint about what to do next. The title shows "Settings" but the voice says "Lab settings" |
| Settings sheet | modal semantics | WARN | `aria-modal=true`, but the Capture screen behind it is not `inert`/`aria-hidden` |
| More settings collapsed | state | PASS | `aria-expanded=false`, content hidden; spoken "More settings collapsed."; focus stays on the toggle |
| More settings expanded | names / 48 px / 200% | PASS | 21 controls, 0 problems, 0 px overflow; `aria-expanded=true`; arrow glyph is `aria-hidden` |
| Ask (typing box) | names / 48 px / 200% | PASS | 0 problems, 0 px overflow |
| Ask | focus on entry | PASS | `#gt-ask-input` |
| Ask | spoken next step | PASS | "This browser can't listen… Type your question… then press Send." |
| Ask | send | PASS | "Thinking..." then the answer; no live duplication; focus then goes to the `Ask` button |
| Ask | Back | PASS | Capture; "Take a photo… Samples work without internet."; focus on `Take photo` |
| Correct | names / 48 px / 200% | PASS | 0 problems, 0 px overflow |
| Correct | focus on entry | PASS | `h1.gt-correct__title` |
| Correct | duplicate speech | **FAIL** | `correct.intro` is spoken **twice** (App and screen both speak it) |
| Correct | Back (Cancel, not dirty) | PASS | Explore, full entry line spoken, focus on the canvas |
| Teach | names / 48 px / 200% | PASS | 0 problems, 0 px overflow |
| Teach | focus / speech / live | PASS | `h1.gt-teach__title`; "Teacher editor…"; live banner "Diagram is valid…" is not also spoken |
| Teach | Back | **FAIL** | opened from Capture → Settings, but Back goes to **Start**, not Capture; Start then speaks 3 lines that overlap |
| Build (Make my own graph) | names / 48 px / 200% | PASS | 0 problems, 0 px overflow |
| Build | focus on entry | PASS | `h1.gt-build__title` |
| Build | spoken next step | **FAIL** | the prompt "Empty graph… Set x and y, then press Pin." is cut off right away by "Plot a graph" |
| Build | Back | PASS | Capture prompt; focus on `Take photo` |
| Saved diagrams (1 entry) | names / 48 px / 200% | PASS | 0 problems, 0 px overflow (entry made through Correct → Save) |
| Saved | focus on entry | PASS | `h1.gt-saved__heading` |
| Saved | speech on entry | WARN | "Saved diagrams" is cut off at once by the list "Right Triangle ABC"; no next-step hint (Open / Delete) |
| Saved | Delete | PASS | focus moves to `Confirm delete Right Triangle ABC`; "Delete …? Tap confirm to delete." |
| Saved | Cancel | PASS | focus goes back to `Delete Right Triangle ABC`; "Delete cancelled."; no live duplication |
| Saved | Back | PASS | Capture prompt; focus on `Take photo` |
| Raw-mode notice (mocked) | names / 48 px / 200% | PASS | 0 problems, 0 px overflow |
| Raw-mode notice | live + speech duplicated | **FAIL** | speech says "I couldn't fully read this diagram. You can still feel its outlines…" and a `role=status` notice also announces "The creature's eyes are blurry. You can still feel the outlines." TalkBack will read both |
| Raw-mode notice | focus | PASS | canvas, with a full accessible name |
| Start / Capture / Settings in Hindi | names / 48 px / 200% | PASS | all names in Hindi (e.g. "नमूना: त्रिभुज"), `html lang=hi`, 0 px overflow |
| Start / Capture / Settings in Gujarati | names / 48 px / 200% | PASS | all names in Gujarati, `html lang=gu`, 0 px overflow |
| Language switch | speech | PASS (emulator) | no-voice notice, then the confirmation in the chosen language (no hi or gu voice in headless Chromium) |

## Real defects (file:line suspects)

1. **Build next-step line is cut off.** `frontend/src/App.tsx:751` speaks `build.prompt`. Then `frontend/src/screens/Build.tsx:122` speaks `build.title` on mount. `speak` cancels whatever is playing (`drivers/speech.ts:320-322`), so a blind user hears only "Plot a graph". Fix: drop one of the two, or queue the title before the prompt.
2. **Correct intro is spoken twice.** `frontend/src/App.tsx:790` and `frontend/src/screens/Correct.tsx:219` both speak `correct.intro`. The second call restarts the sentence. Fix: keep one.
3. **Raw notice is announced twice.** `frontend/src/screens/Explore.tsx:2927` uses `role="status"` on the raw notice while the entry speech already says the same thing. Fix: use the `StatusText` pattern (plain text when `canSpeak`).
4. **Teach Back lands on Start.** `frontend/src/App.tsx:858-876` (`handleTeachBack`) goes to `start` whenever there is no `lastExploreScene`, even though Teach was opened from Capture's Settings. Start then speaks `host.start.next`, the greeting and the language offer, and they overlap. Fix: go back to Capture, or to the screen Teach came from.
5. Minor: `frontend/src/App.tsx:826` speaks "Saved diagrams", and the list read from `SavedDiagrams.tsx` cuts it off right away. Neither line says what to do next (Open, Pin, Delete).
6. Minor: the Settings voice says "Lab settings opened" (`i18n/index.ts:301`) but the sheet title is "Settings". There is also no next-step hint.
7. Cosmetic: the `aria-hidden` debug text "Relative cursor: waiting for touch" (`.gt-explore__debug`) shows on the production Explore screen (see `ask.png`).

## Not reached or not fully checked
- Raw Mode came only from a **mocked** `/api/v1/scene` response. The real backend was not running.
- Settings sheet in Hindi/Gujarati: only names and overflow were checked. Teach, Correct, Build and Saved were checked in English only.
- Focus trap inside the Settings sheet (Tab or swipe past the last control) was not tested.

## Must be tested by a person on a phone with TalkBack
- Whether TalkBack can swipe out of the Settings sheet into the Capture screen behind it (`aria-modal` without `inert`).
- Whether the app's speech and TalkBack's own focus announcements talk over each other on every screen entry (headings are focused *and* speech plays).
- Whether the Raw notice really is read twice (defect 3), and whether the Build prompt really is lost (defect 1) on a real voice engine.
- Hindi and Gujarati voices: whether a voice exists, how it pronounces the text, and whether the English no-voice notice sounds right.
- Saved: whether Delete → Confirm/Cancel keeps TalkBack focus on the new button (DOM focus does move correctly).
- Ask with real `webkitSpeechRecognition`: the listening tone, the 6 s timeout, and the two-finger long-press.
- Target sizes with Android's largest display size (not only font size), and double-tap-and-hold on the canvas.

## Screenshots (390x844; each also has a `-200pct.png` twin)
All are in `C:\Users\Admin\AppData\Local\Temp\claude\34e8f85f16ba9e56\94f91917-23b2-4996-bf65-fa41bfac5709\scratchpad\shots\`:
`settings.png`, `settings-more-expanded.png`, `ask.png`, `correct.png`, `teach.png`, `build.png`, `saved.png`, `saved-confirming.png`, `raw-explore.png`, `settings-hindi.png`, `capture-hindi.png`, `start-hindi.png`, `settings-gujarati.png`, `capture-gujarati.png`, `start-gujarati.png`.
